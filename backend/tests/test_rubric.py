from decimal import Decimal
from app.grading.evaluator import evaluate_submission
from app.models import CriterionType, ExecutionResult, ExecutionStatus, QualityMetric, Rubric, RubricCriterion

def test_rubric_evaluation_weighted_score():
    rubric = Rubric(title="Test Rubric")
    rubric.criteria = [
        RubricCriterion(
            title="Tests",
            criterion_type=CriterionType.FUNCTIONAL_TEST,
            weight=Decimal("0.6000"),
            max_points=Decimal("6.00"),
        ),
        RubricCriterion(
            title="Quality",
            criterion_type=CriterionType.CODE_QUALITY,
            weight=Decimal("0.4000"),
            max_points=Decimal("4.00"),
            evaluation_config={"deduction_per_ruff_issue": "0.50"},
        ),
    ]

    # Submissions passed 4/5 tests (80% of 6 = 4.80)
    exec_res = ExecutionResult(
        status=ExecutionStatus.FAILED,
        passed_count=4,
        failed_count=1,
        total_count=5,
        execution_time_ms=100,
    )

    # 2 ruff errors -> 2 * 0.50 = 1.00 deduction (4.00 - 1.00 = 3.00)
    qm = QualityMetric(
        cyclomatic_complexity_max=4,
        cyclomatic_complexity_avg=Decimal("3.00"),
        max_nesting_depth=2,
        loc_total=50,
        function_count=2,
        ruff_violations=[{"code": "E501"}, {"code": "F401"}],
    )

    res = evaluate_submission(rubric, exec_res, qm, max_score=Decimal("10.00"))
    # Tests: 4.80 * 0.6 = 2.88
    # Quality: 3.00 * 0.4 = 1.20
    # Total: 2.88 + 1.20 = 4.08
    assert res["automated_grade"] == Decimal("4.08")
    assert "Tests" in res["breakdown"]
    assert "Quality" in res["breakdown"]
