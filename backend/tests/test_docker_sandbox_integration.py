from pathlib import Path

import docker
import pytest
from docker.errors import DockerException, ImageNotFound

from app.models import TestCase, TestOutcome
from app.sandbox_runner import DockerSandboxRunner


@pytest.fixture(autouse=True)
def require_sandbox_image() -> None:
    try:
        client = docker.from_env(timeout=3)
        client.ping()
        client.images.get("grading-sandbox:latest")
    except (DockerException, ImageNotFound):
        pytest.skip("Docker engine or grading-sandbox:latest image is unavailable")


@pytest.mark.docker
def test_real_sandbox_runs_student_code_and_reports_results(tmp_path: Path) -> None:
    source = tmp_path / "solution.py"
    source.write_text("def add(a, b):\n    return a + b\n", encoding="utf-8")
    test_cases = [
        TestCase(id=1, assignment_id=1, name="passing", content="from solution import add\n\ndef test_add():\n    assert add(2, 3) == 5\n"),
        TestCase(id=2, assignment_id=1, name="failing", content="from solution import add\n\ndef test_wrong_expectation():\n    assert add(2, 3) == 6\n"),
    ]

    result = DockerSandboxRunner().run(source, test_cases)

    assert result.infrastructure_error is None
    assert result.timed_out is False
    assert [item.outcome for item in result.results] == [TestOutcome.PASSED, TestOutcome.FAILED]


@pytest.mark.docker
def test_real_sandbox_stops_infinite_loop(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    source = tmp_path / "solution.py"
    source.write_text("def hang():\n    while True:\n        pass\n", encoding="utf-8")
    test_cases = [
        TestCase(id=1, assignment_id=1, name="timeout", content="from solution import hang\n\ndef test_hang():\n    hang()\n"),
    ]
    runner = DockerSandboxRunner()
    monkeypatch.setattr(runner.settings, "grading_timeout_seconds", 2)

    result = runner.run(source, test_cases)

    assert result.timed_out is True
