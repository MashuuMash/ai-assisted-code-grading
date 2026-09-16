import io
import json
import re
import tarfile
import time
from contextlib import suppress
from dataclasses import dataclass
from pathlib import Path

import docker
from docker.errors import DockerException, NotFound
from docker.types import LogConfig
from requests import ConnectionError as RequestsConnectionError
from requests import ReadTimeout

from app.config import get_settings
from app.models import TestCase, TestOutcome

REPORT_PLUGIN = r"""
import json
import time
from pathlib import Path

started = time.monotonic()
results = []

def _detail(report):
    text = str(report.longrepr) if report.failed else ""
    return text[-4000:]

def pytest_runtest_logreport(report):
    if report.when == "call":
        kind = None
        if report.failed:
            kind = "assertion_failure" if "AssertionError" in _detail(report) else "runtime_error"
        results.append({"nodeid": report.nodeid, "outcome": report.outcome,
                        "duration_ms": round(report.duration * 1000),
                        "failure_type": kind, "failure_detail": _detail(report)})
    elif report.when == "setup" and report.failed:
        results.append({"nodeid": report.nodeid, "outcome": "error",
                        "duration_ms": round(report.duration * 1000),
                        "failure_type": "runtime_error", "failure_detail": _detail(report)})

def pytest_collectreport(report):
    if report.failed:
        detail = _detail(report)
        kind = "syntax_error" if "SyntaxError" in detail else "collection_error"
        results.append({"nodeid": report.nodeid, "outcome": "error", "duration_ms": 0,
                        "failure_type": kind, "failure_detail": detail})

def pytest_sessionfinish(session, exitstatus):
    payload = {"runtime_ms": round((time.monotonic() - started) * 1000), "results": results}
    Path("/workspace/grading-report.json").write_text(json.dumps(payload), encoding="utf-8")
"""


@dataclass(frozen=True)
class SandboxTestResult:
    test_case_id: int
    test_name: str
    outcome: TestOutcome
    duration_ms: int
    failure_type: str | None
    failure_detail: str | None


@dataclass(frozen=True)
class SandboxResult:
    timed_out: bool
    infrastructure_error: str | None
    runtime_ms: int
    output: str
    results: list[SandboxTestResult]


class DockerSandboxRunner:
    def __init__(self) -> None:
        self.settings = get_settings()

    def run(self, source_path: Path, test_cases: list[TestCase]) -> SandboxResult:
        if not source_path.is_file():
            return SandboxResult(False, "Submission source is unavailable on disk", 0, "", [])

        container = None
        workspace_volume = None
        workspace_helper = None
        started = time.monotonic()

        try:
            client = docker.from_env(timeout=self.settings.grading_timeout_seconds + 5)
            workspace_volume = client.volumes.create(labels={"app": "grading-sandbox"})

            workspace_helper = client.containers.create(
                self.settings.grading_sandbox_image,
                ["chown", "10001:10001", "/workspace"],
                network_disabled=True,
                user="0:0",
                volumes={workspace_volume.name: {"bind": "/workspace", "mode": "rw"}},
            )
            workspace_helper.put_archive("/workspace", self._workspace_archive(source_path, test_cases))
            workspace_helper.start()
            workspace_helper.wait()
            workspace_helper.remove()
            workspace_helper = None

            container = client.containers.create(
                self.settings.grading_sandbox_image,
                ["python", "-m", "pytest", "-q", "-p", "grading_plugin", "-p", "no:cacheprovider", "tests"],
                network_disabled=True,
                mem_limit=self.settings.grading_memory,
                memswap_limit=self.settings.grading_memory,
                nano_cpus=int(self.settings.grading_cpus * 1_000_000_000),
                pids_limit=self.settings.grading_pids_limit,
                read_only=True,
                cap_drop=["ALL"],
                security_opt=["no-new-privileges"],
                user="10001:10001",
                tmpfs={"/tmp": "rw,noexec,nosuid,size=16m,mode=1777"},
                volumes={workspace_volume.name: {"bind": "/workspace", "mode": "rw"}},
                working_dir="/workspace",
                environment={"HOME": "/tmp", "PYTHONDONTWRITEBYTECODE": "1"},
                log_config=LogConfig(
                    type="json-file",
                    config={"max-size": "64k", "max-file": "1"},
                ),
            )
            container.start()

            try:
                container.wait(timeout=self.settings.grading_timeout_seconds)
            except (ReadTimeout, RequestsConnectionError) as exc:
                if "timed out" not in str(exc).lower():
                    raise
                with suppress(DockerException, RequestsConnectionError):
                    container.kill()
                return SandboxResult(True, None, self._elapsed(started), self._logs(container), [])

            output = self._logs(container)
            try:
                stream, _ = container.get_archive("/workspace/grading-report.json")
            except NotFound:
                return SandboxResult(
                    False, "Sandbox did not produce a valid test report", self._elapsed(started), output, []
                )

            report = self._archive_file(b"".join(stream))
            return self._parse_report(report, test_cases, output)

        except DockerException as exc:
            return SandboxResult(False, f"Docker sandbox error: {exc}", self._elapsed(started), "", [])
        finally:
            if workspace_helper is not None:
                with suppress(DockerException, RequestsConnectionError):
                    workspace_helper.remove(force=True)
            if container is not None:
                with suppress(DockerException, RequestsConnectionError):
                    container.remove(force=True)
            if workspace_volume is not None:
                with suppress(DockerException, RequestsConnectionError):
                    workspace_volume.remove(force=True)

    def _workspace_archive(self, source_path: Path, test_cases: list[TestCase]) -> io.BytesIO:
        buffer = io.BytesIO()
        with tarfile.open(fileobj=buffer, mode="w") as archive:
            self._add_bytes(archive, "solution.py", source_path.read_bytes())
            self._add_bytes(archive, "grading_plugin.py", REPORT_PLUGIN.encode("utf-8"))
            for tc in test_cases:
                filename = f"tests/test_case_{tc.id}.py"
                self._add_bytes(archive, filename, tc.content.encode("utf-8"))
        buffer.seek(0)
        return buffer

    @staticmethod
    def _add_bytes(archive: tarfile.TarFile, name: str, data: bytes) -> None:
        info = tarfile.TarInfo(name=name)
        info.size = len(data)
        info.mode = 0o644
        info.uid = 10001
        info.gid = 10001
        archive.addfile(info, io.BytesIO(data))

    @staticmethod
    def _archive_file(payload: bytes) -> str:
        with tarfile.open(fileobj=io.BytesIO(payload), mode="r") as archive:
            first_member = archive.getmembers()[0]
            extracted = archive.extractfile(first_member)
            if extracted is None:
                return "{}"
            return extracted.read().decode("utf-8", errors="replace")

    def _parse_report(self, report_json: str, test_cases: list[TestCase], output: str) -> SandboxResult:
        try:
            data = json.loads(report_json)
        except json.JSONDecodeError:
            return SandboxResult(False, "Report JSON decoding failed", 0, output, [])

        runtime_ms = int(data.get("runtime_ms", 0))
        results_by_case: dict[int, SandboxTestResult] = {}
        tc_map = {tc.id: tc for tc in test_cases}

        for item in data.get("results", []):
            nodeid = str(item.get("nodeid", ""))
            match = re.search(r"test_case_(\d+)\.py(?:::(\w+))?", nodeid)
            if not match:
                continue
            tc_id = int(match.group(1))
            tc = tc_map.get(tc_id)
            if not tc:
                continue

            name = match.group(2) or tc.name
            raw_outcome = str(item.get("outcome", "error")).lower()
            outcome = TestOutcome.PASSED if raw_outcome == "passed" else (
                TestOutcome.FAILED if raw_outcome == "failed" else TestOutcome.ERROR
            )
            results_by_case[tc_id] = SandboxTestResult(
                test_case_id=tc_id,
                test_name=name,
                outcome=outcome,
                duration_ms=int(item.get("duration_ms", 0)),
                failure_type=item.get("failure_type"),
                failure_detail=item.get("failure_detail"),
            )

        # Populate missing test cases as ERROR
        final_results = []
        for tc in test_cases:
            if tc.id in results_by_case:
                final_results.append(results_by_case[tc.id])
            else:
                final_results.append(
                    SandboxTestResult(
                        test_case_id=tc.id,
                        test_name=tc.name,
                        outcome=TestOutcome.ERROR,
                        duration_ms=0,
                        failure_type="collection_error",
                        failure_detail="Test was not collected or executed",
                    )
                )

        return SandboxResult(False, None, runtime_ms, output, final_results)

    @staticmethod
    def _elapsed(started: float) -> int:
        return round((time.monotonic() - started) * 1000)

    @staticmethod
    def _logs(container) -> str:
        try:
            return container.logs().decode("utf-8", errors="replace")
        except Exception:
            return ""
