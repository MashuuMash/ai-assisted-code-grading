import json
import logging
import shutil
import subprocess
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from app.ast_analyzer import AstAnalysisResult, AstAnalyzer

logger = logging.getLogger(__name__)


@dataclass
class RuffIssue:
    code: str
    message: str
    line_number: int | None = None
    column_number: int | None = None
    end_line_number: int | None = None
    end_column_number: int | None = None
    filename: str = "submission.py"
    severity: str = "warning"


@dataclass
class StaticAnalysisReport:
    is_valid_python: bool = True
    ruff_issues: list[RuffIssue] = field(default_factory=list)
    ast_result: AstAnalysisResult = field(default_factory=AstAnalysisResult)

    @property
    def total_issues_count(self) -> int:
        return len(self.ruff_issues) + len(self.ast_result.issues)

    def to_dict(self) -> dict[str, Any]:
        return {
            "is_valid_python": self.is_valid_python,
            "total_issues_count": self.total_issues_count,
            "ruff_issues": [asdict(issue) for issue in self.ruff_issues],
            "ast_result": self.ast_result.to_dict(),
        }


def _determine_ruff_severity(code: str) -> str:
    if code.startswith("E9") or code == "SyntaxError" or code == "F821":
        return "error"
    if code.startswith("F"):
        return "warning"
    if code.startswith("E") or code.startswith("W"):
        return "info"
    return "warning"


def _locate_ruff_executable() -> str:
    which_path = shutil.which("ruff")
    if which_path:
        return which_path

    # Check virtualenv directory
    py_dir = Path(sys.executable).parent
    for candidate in ["ruff", "ruff.exe"]:
        cand_path = py_dir / candidate
        if cand_path.is_file():
            return str(cand_path)

    return "ruff"


def run_ruff_linter(source_code: str, filename: str = "submission.py") -> list[RuffIssue]:
    ruff_bin = _locate_ruff_executable()
    cmd = [
        ruff_bin,
        "check",
        "--output-format=json",
        "--no-cache",
        "--stdin-filename",
        filename,
        "-",
    ]

    try:
        proc = subprocess.run(
            cmd,
            input=source_code,
            text=True,
            capture_output=True,
            check=False,
            timeout=10,
        )
    except FileNotFoundError:
        logger.warning("Ruff executable not found at '%s', skipping ruff check", ruff_bin)
        return []
    except subprocess.TimeoutExpired:
        logger.warning("Ruff lint check timed out")
        return []
    except Exception as exc:
        logger.warning("Failed to run ruff linter: %s", exc)
        return []

    output = proc.stdout.strip()
    if not output:
        return []

    try:
        diagnostics = json.loads(output)
    except json.JSONDecodeError:
        logger.warning("Failed to parse Ruff JSON output: %s", output[:200])
        return []

    issues: list[RuffIssue] = []
    for diag in diagnostics:
        code = diag.get("code") or "UNKNOWN"
        message = diag.get("message") or ""
        location = diag.get("location") or {}
        end_location = diag.get("end_location") or {}

        issues.append(
            RuffIssue(
                code=code,
                message=message,
                line_number=location.get("row"),
                column_number=location.get("column"),
                end_line_number=end_location.get("row"),
                end_column_number=end_location.get("column"),
                filename=filename,
                severity=_determine_ruff_severity(code),
            )
        )

    return issues


class StaticAnalyzer:
    def __init__(self, ast_analyzer: AstAnalyzer | None = None) -> None:
        self.ast_analyzer = ast_analyzer or AstAnalyzer()

    def analyze_source(self, source_code: str, filename: str = "submission.py") -> StaticAnalysisReport:
        ast_result = self.ast_analyzer.analyze_source(source_code)
        ruff_issues = run_ruff_linter(source_code, filename=filename)

        is_valid = ast_result.is_valid_python and not any(issue.code.startswith("E9") for issue in ruff_issues)

        return StaticAnalysisReport(
            is_valid_python=is_valid,
            ruff_issues=ruff_issues,
            ast_result=ast_result,
        )

    def analyze_file(self, file_path: str | Path) -> StaticAnalysisReport:
        path = Path(file_path)
        if not path.is_file():
            res = AstAnalysisResult(is_valid_python=False, syntax_error_message="Source file does not exist")
            return StaticAnalysisReport(is_valid_python=False, ast_result=res)

        try:
            content = path.read_text(encoding="utf-8", errors="replace")
        except Exception as exc:
            res = AstAnalysisResult(is_valid_python=False, syntax_error_message=f"Failed to read file: {exc}")
            return StaticAnalysisReport(is_valid_python=False, ast_result=res)

        return self.analyze_source(content, filename=path.name)
