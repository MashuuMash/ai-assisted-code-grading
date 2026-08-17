import os
import tempfile
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.models import TestOutcome as GradingTestOutcome
from app.sandbox_runner import DockerSandboxRunner

pytestmark = pytest.mark.skipif(os.getenv("RUN_SANDBOX_TESTS") != "1", reason="requires Docker sandbox image")


def run_source(source: str, test_content: str):
    with tempfile.TemporaryDirectory() as directory:
        source_path = Path(directory) / "submission.py"
        source_path.write_text(source, encoding="utf-8")
        test_case = SimpleNamespace(id=101, name="integration", content=test_content)
        return DockerSandboxRunner().run(source_path, [test_case])


def test_sandbox_success_and_failed_test() -> None:
    result = run_source(
        "def answer():\n    return 42\n",
        "import solution\n\ndef test_pass(): assert solution.answer() == 42\n"
        "def test_fail(): assert solution.answer() == 99\n",
    )
    assert result.infrastructure_error is None
    assert {item.outcome for item in result.results} == {GradingTestOutcome.PASSED, GradingTestOutcome.FAILED}


def test_sandbox_reports_syntax_and_runtime_errors() -> None:
    syntax = run_source("def broken(:\n", "import solution\n\ndef test_load(): assert True\n")
    runtime = run_source(
        "def answer():\n    raise RuntimeError('boom')\n",
        "import solution\n\ndef test_runtime(): solution.answer()\n",
    )
    assert any(item.failure_type == "syntax_error" for item in syntax.results)
    assert any(item.failure_type == "runtime_error" for item in runtime.results)


def test_sandbox_enforces_timeout() -> None:
    result = run_source("while True:\n    pass\n", "import solution\n\ndef test_load(): assert True\n")
    assert result.timed_out is True
