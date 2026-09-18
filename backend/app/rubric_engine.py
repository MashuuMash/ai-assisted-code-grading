import math
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import (
    CriterionScore,
    EvaluationType,
    EvidenceCategory,
    EvidenceSeverity,
    EvidenceSource,
    GradeStatus,
    Rubric,
    RubricCriterion,
    Submission,
    SubmissionEvidence,
    SubmissionGrade,
)
from app.schemas import RubricCriterionCreate


def validate_criteria_weights(criteria: Sequence[RubricCriterionCreate | RubricCriterion]) -> None:
    if not criteria:
        raise ValueError("Rubric must contain at least one criterion")

    total_weight = sum(c.weight_percentage for c in criteria)
    if not math.isclose(total_weight, 100.0, abs_tol=0.05):
        raise ValueError(
            f"Rubric criteria weights must sum to 100.0% (current sum: {total_weight:.2f}%)"
        )


def _evaluate_criterion(
    criterion: RubricCriterion,
    evidence_records: list[SubmissionEvidence],
) -> tuple[float, str]:
    max_pts = criterion.max_points
    cfg = criterion.config or {}

    if criterion.evaluation_type == EvaluationType.AUTOMATED_TEST:
        target_category = criterion.category
        test_evs = [
            e
            for e in evidence_records
            if e.source == EvidenceSource.PYTEST and e.category == target_category
        ]

        if not test_evs:
            return 0.0, f"No {target_category.value} test results found"

        passed = [e for e in test_evs if e.rule_code == "TEST_PASSED"]
        total = len(test_evs)
        pass_ratio = len(passed) / total
        score = round(pass_ratio * max_pts, 2)
        justification = (
            f"Passed {len(passed)}/{total} tests ({pass_ratio * 100.0:.1f}%) -> {score}/{max_pts} points"
        )
        return score, justification

    elif criterion.evaluation_type == EvaluationType.CODE_QUALITY:
        ruff_evs = [e for e in evidence_records if e.source == EvidenceSource.RUFF]
        errors = sum(1 for e in ruff_evs if e.severity == EvidenceSeverity.ERROR)
        warnings = sum(1 for e in ruff_evs if e.severity == EvidenceSeverity.WARNING)

        penalty_error = float(cfg.get("penalty_per_error", 0.5))
        penalty_warning = float(cfg.get("penalty_per_warning", 0.1))

        total_deduction = errors * penalty_error + warnings * penalty_warning
        score = max(0.0, round(max_pts - total_deduction, 2))
        justification = (
            f"Found {errors} errors, {warnings} warnings. "
            f"Deducted {min(max_pts, total_deduction):.2f} points -> {score}/{max_pts} points"
        )
        return score, justification

    elif criterion.evaluation_type == EvaluationType.STRUCTURAL_COMPLEXITY:
        complexity_evs = [
            e
            for e in evidence_records
            if e.source == EvidenceSource.AST
            and e.category == EvidenceCategory.COMPLEXITY
            and e.severity in {EvidenceSeverity.WARNING, EvidenceSeverity.ERROR}
        ]
        violations = len(complexity_evs)
        penalty_per_violation = float(cfg.get("penalty_per_violation", 0.5))
        deduction = violations * penalty_per_violation
        score = max(0.0, round(max_pts - deduction, 2))
        justification = (
            f"{violations} complexity threshold violations detected. "
            f"Deducted {min(max_pts, deduction):.2f} points -> {score}/{max_pts} points"
        )
        return score, justification

    else:
        return 0.0, "Manual evaluation criterion pending instructor review"


def evaluate_submission_grade(db: Session, submission_id: int) -> SubmissionGrade | None:
    sub = db.scalar(
        select(Submission)
        .options(
            selectinload(Submission.evidence_records),
            selectinload(Submission.grade).selectinload(SubmissionGrade.criterion_scores),
        )
        .where(Submission.id == submission_id)
    )
    if not sub or not sub.assignment:
        return None

    rubric = db.scalar(
        select(Rubric)
        .options(selectinload(Rubric.criteria))
        .where(Rubric.assignment_id == sub.assignment_id)
    )
    if not rubric or not rubric.criteria:
        return None

    evidence = list(sub.evidence_records)

    # Existing grade or new grade
    grade = sub.grade
    if not grade:
        grade = SubmissionGrade(
            submission_id=sub.id,
            rubric_id=rubric.id,
            suggested_total_score=0.0,
            final_total_score=None,
            status=GradeStatus.DRAFT,
        )
        db.add(grade)
        db.flush()

    existing_scores_map = {cs.criterion_id: cs for cs in grade.criterion_scores}

    suggested_total = 0.0
    final_total = 0.0
    has_overrides = False

    for crit in rubric.criteria:
        s_score, just = _evaluate_criterion(crit, evidence)
        suggested_total += s_score

        if crit.id in existing_scores_map:
            cs = existing_scores_map[crit.id]
            cs.suggested_score = s_score
            cs.justification = just
            if not cs.is_overridden:
                cs.final_score = s_score
                final_total += s_score
            else:
                has_overrides = True
                final_total += cs.final_score
        else:
            cs = CriterionScore(
                submission_grade_id=grade.id,
                criterion_id=crit.id,
                suggested_score=s_score,
                final_score=s_score,
                is_overridden=False,
                justification=just,
            )
            db.add(cs)
            final_total += s_score

    grade.suggested_total_score = round(suggested_total, 2)
    if not has_overrides:
        grade.final_total_score = round(suggested_total, 2)
    else:
        grade.final_total_score = round(final_total, 2)

    db.commit()
    db.refresh(grade)
    return grade
