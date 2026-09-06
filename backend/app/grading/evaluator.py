from decimal import Decimal
from typing import Any, Dict, List, Optional
from app.models import CriterionType, ExecutionResult, QualityMetric, Rubric

def evaluate_submission(
    rubric: Optional[Rubric],
    execution_result: Optional[ExecutionResult],
    quality_metric: Optional[QualityMetric],
    max_score: Decimal = Decimal("10.00"),
) -> Dict[str, Any]:
    """
    Evaluates a submission against an assignment rubric using deterministic evidence:
    - Functional test outcomes
    - Ruff static analysis violations
    - AST complexity and nesting depth
    """
    if not rubric or not rubric.criteria:
        # Default fallback calculation: purely based on functional tests
        if execution_result and execution_result.total_count > 0:
            ratio = Decimal(str(execution_result.passed_count)) / Decimal(str(execution_result.total_count))
            auto_grade = round(ratio * max_score, 2)
        else:
            auto_grade = Decimal("0.00")

        return {
            "automated_grade": auto_grade,
            "breakdown": {
                "functional_tests": float(auto_grade),
            },
        }

    total_weighted_points = Decimal("0.00")
    total_weight = Decimal("0.00")
    breakdown = {}

    for criterion in rubric.criteria:
        points = Decimal("0.00")
        cfg = criterion.evaluation_config or {}

        if criterion.criterion_type == CriterionType.FUNCTIONAL_TEST:
            if execution_result and execution_result.total_count > 0:
                pass_ratio = Decimal(str(execution_result.passed_count)) / Decimal(str(execution_result.total_count))
                points = pass_ratio * criterion.max_points
            else:
                points = Decimal("0.00")

        elif criterion.criterion_type == CriterionType.CODE_QUALITY:
            # Base max points, deduct per Ruff warning
            deduction_per_issue = Decimal(str(cfg.get("deduction_per_ruff_issue", "0.20")))
            issue_count = len(quality_metric.ruff_violations) if quality_metric else 0
            total_deduction = Decimal(str(issue_count)) * deduction_per_issue
            points = max(Decimal("0.00"), criterion.max_points - total_deduction)

        elif criterion.criterion_type == CriterionType.AST_STRUCTURE:
            points = criterion.max_points
            if quality_metric:
                max_cc_threshold = cfg.get("max_cyclomatic_complexity", 10)
                max_nesting_threshold = cfg.get("max_nesting_depth", 4)
                
                # Deductions for high complexity or nesting
                if quality_metric.cyclomatic_complexity_max > max_cc_threshold:
                    points -= Decimal(str(cfg.get("cc_penalty", "1.00")))
                if quality_metric.max_nesting_depth > max_nesting_threshold:
                    points -= Decimal(str(cfg.get("nesting_penalty", "0.50")))
                if quality_metric.banned_imports_found:
                    points -= Decimal(str(cfg.get("banned_import_penalty", "2.00")))
            points = max(Decimal("0.00"), points)

        else:  # CUSTOM
            points = criterion.max_points

        points = min(points, criterion.max_points)
        weighted_score = points * criterion.weight
        total_weighted_points += weighted_score
        total_weight += criterion.weight
        breakdown[criterion.title] = {
            "criterion_type": criterion.criterion_type.value,
            "points": float(round(points, 2)),
            "max_points": float(criterion.max_points),
            "weight": float(criterion.weight),
            "weighted_score": float(round(weighted_score, 2)),
        }

    # Normalize if weights don't sum to exactly 1
    if total_weight > Decimal("0.00"):
        final_automated = round(total_weighted_points / total_weight, 2)
    else:
        final_automated = round(total_weighted_points, 2)

    # Scale to assignment max_score if needed
    final_grade = min(final_automated, max_score)

    return {
        "automated_grade": final_grade,
        "breakdown": breakdown,
    }
