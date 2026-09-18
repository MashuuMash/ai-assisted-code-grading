import uuid
from typing import Sequence

from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.models import (
    EvidenceCategory,
    EvidenceSeverity,
    EvidenceSource,
    SubmissionEvidence,
    TestOutcome,
    TestResult,
    TestVisibility,
)
from app.static_analysis import StaticAnalysisReport


def _map_severity(severity_str: str) -> EvidenceSeverity:
    if severity_str == "error":
        return EvidenceSeverity.ERROR
    if severity_str == "warning":
        return EvidenceSeverity.WARNING
    return EvidenceSeverity.INFO


def generate_test_evidence(
    submission_id: int,
    assignment_id: int,
    test_results: Sequence[TestResult],
    test_visibility_map: dict[int, TestVisibility] | None = None,
) -> list[SubmissionEvidence]:
    visibility_map = test_visibility_map or {}
    evidence_list: list[SubmissionEvidence] = []

    for item in test_results:
        is_hidden = visibility_map.get(item.test_case_id) == TestVisibility.HIDDEN
        category = EvidenceCategory.ROBUSTNESS if is_hidden else EvidenceCategory.CORRECTNESS

        if item.outcome == TestOutcome.PASSED:
            ev = SubmissionEvidence(
                id=uuid.uuid4().hex,
                submission_id=submission_id,
                assignment_id=assignment_id,
                source=EvidenceSource.PYTEST,
                category=category,
                severity=EvidenceSeverity.INFO,
                rule_code="TEST_PASSED",
                message=f"Test '{item.test_name}' passed in {item.duration_ms}ms",
                metric_value=1.0,
                raw_data={
                    "test_case_id": item.test_case_id,
                    "test_name": item.test_name,
                    "duration_ms": item.duration_ms,
                    "is_hidden": is_hidden,
                },
            )
        else:
            ev = SubmissionEvidence(
                id=uuid.uuid4().hex,
                submission_id=submission_id,
                assignment_id=assignment_id,
                source=EvidenceSource.PYTEST,
                category=category,
                severity=EvidenceSeverity.ERROR,
                rule_code=item.failure_type or "TEST_FAILED",
                message=item.failure_detail or f"Test '{item.test_name}' failed",
                metric_value=0.0,
                raw_data={
                    "test_case_id": item.test_case_id,
                    "test_name": item.test_name,
                    "failure_type": item.failure_type,
                    "failure_detail": item.failure_detail,
                    "duration_ms": item.duration_ms,
                    "is_hidden": is_hidden,
                },
            )
        evidence_list.append(ev)

    return evidence_list


def generate_static_analysis_evidence(
    submission_id: int,
    assignment_id: int,
    report: StaticAnalysisReport,
) -> list[SubmissionEvidence]:
    evidence_list: list[SubmissionEvidence] = []

    # Ruff linter findings
    for issue in report.ruff_issues:
        loc_str = (
            f"{issue.filename}:{issue.line_number}:{issue.column_number}"
            if issue.line_number is not None
            else issue.filename
        )
        ev = SubmissionEvidence(
            id=uuid.uuid4().hex,
            submission_id=submission_id,
            assignment_id=assignment_id,
            source=EvidenceSource.RUFF,
            category=EvidenceCategory.CODE_QUALITY,
            severity=_map_severity(issue.severity),
            rule_code=issue.code,
            message=issue.message,
            location=loc_str,
            raw_data={
                "line_number": issue.line_number,
                "column_number": issue.column_number,
                "end_line_number": issue.end_line_number,
                "end_column_number": issue.end_column_number,
                "filename": issue.filename,
            },
        )
        evidence_list.append(ev)

    # AST Quality issues
    for ast_issue in report.ast_result.issues:
        category = (
            EvidenceCategory.COMPLEXITY
            if ast_issue.rule_code in {"DEEP_NESTING", "HIGH_CYCLOMATIC_COMPLEXITY"}
            else EvidenceCategory.CODE_QUALITY
        )
        loc_str = f"line {ast_issue.line_number}" if ast_issue.line_number else None
        ev = SubmissionEvidence(
            id=uuid.uuid4().hex,
            submission_id=submission_id,
            assignment_id=assignment_id,
            source=EvidenceSource.AST,
            category=category,
            severity=_map_severity(ast_issue.severity),
            rule_code=ast_issue.rule_code,
            message=ast_issue.message,
            location=loc_str,
            metric_value=ast_issue.metric_value,
            raw_data={
                "line_number": ast_issue.line_number,
                "column_number": ast_issue.column_number,
                "metric_value": ast_issue.metric_value,
            },
        )
        evidence_list.append(ev)

    # AST Summary metrics record
    ast_res = report.ast_result
    summary_ev = SubmissionEvidence(
        id=uuid.uuid4().hex,
        submission_id=submission_id,
        assignment_id=assignment_id,
        source=EvidenceSource.AST,
        category=EvidenceCategory.COMPLEXITY,
        severity=EvidenceSeverity.INFO,
        rule_code="CODE_METRICS_SUMMARY",
        message=(
            f"Code metrics: {ast_res.total_lines} total lines ({ast_res.code_lines} code, "
            f"{ast_res.comment_lines} comments), {ast_res.function_count} functions. "
            f"Max cyclomatic complexity: {ast_res.max_cyclomatic_complexity}, "
            f"Max nesting depth: {ast_res.max_nesting_depth}."
        ),
        metric_value=float(ast_res.max_cyclomatic_complexity),
        raw_data={
            "total_lines": ast_res.total_lines,
            "code_lines": ast_res.code_lines,
            "comment_lines": ast_res.comment_lines,
            "blank_lines": ast_res.blank_lines,
            "function_count": ast_res.function_count,
            "class_count": ast_res.class_count,
            "max_cyclomatic_complexity": ast_res.max_cyclomatic_complexity,
            "max_nesting_depth": ast_res.max_nesting_depth,
            "functions": [f.__dict__ for f in ast_res.functions],
        },
    )
    evidence_list.append(summary_ev)

    return evidence_list


def persist_submission_evidence(
    db: Session,
    submission_id: int,
    evidence_items: list[SubmissionEvidence],
    replace_existing: bool = True,
) -> None:
    if replace_existing:
        db.execute(
            delete(SubmissionEvidence).where(SubmissionEvidence.submission_id == submission_id)
        )
    for ev in evidence_items:
        db.add(ev)
    db.commit()
