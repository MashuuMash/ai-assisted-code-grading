import csv
import io

import pytest

from app.models import (
    Assignment,
    AssignmentStatus,
    Cohort,
    Course,
    EvaluationType,
    EvidenceCategory,
    EvidenceSeverity,
    EvidenceSource,
    Rubric,
    RubricCriterion,
    Submission,
    SubmissionEvidence,
    User,
    UserRole,
)
from app.rubric_engine import evaluate_submission_grade, validate_criteria_weights
from app.schemas import RubricCriterionCreate


def test_validate_criteria_weights():
    c1 = RubricCriterionCreate(
        title="Correctness", category=EvidenceCategory.CORRECTNESS,
        evaluation_type=EvaluationType.AUTOMATED_TEST, weight_percentage=60.0
    )
    c2 = RubricCriterionCreate(
        title="Quality", category=EvidenceCategory.CODE_QUALITY,
        evaluation_type=EvaluationType.CODE_QUALITY, weight_percentage=40.0
    )
    # Valid 100%
    validate_criteria_weights([c1, c2])

    # Invalid: sums to 90%
    c2.weight_percentage = 30.0
    with pytest.raises(ValueError, match="must sum to 100.0%"):
        validate_criteria_weights([c1, c2])

    # Invalid: empty
    with pytest.raises(ValueError, match="at least one criterion"):
        validate_criteria_weights([])


def test_evaluate_submission_grade_mathematical_precision(db):
    lecturer = User(email="prof_rubric@school.edu", username="prof_rubric", full_name="Prof Rubric", hashed_password="x", role=UserRole.LECTURER)
    db.add(lecturer)
    db.flush()

    course = Course(code="CS-RUBRIC", name="Rubric Course", instructor_id=lecturer.id)
    db.add(course)
    db.flush()

    cohort = Cohort(code="RC1", name="Cohort RC1", semester="Fall", year=2026, course_id=course.id)
    db.add(cohort)
    db.flush()

    assignment = Assignment(class_id=cohort.id, title="Rubric Assignment", status=AssignmentStatus.PUBLISHED)
    db.add(assignment)
    db.flush()

    rubric = Rubric(assignment_id=assignment.id, title="Standard 10-Point Rubric", max_score=10.0)
    db.add(rubric)
    db.flush()

    # 4 Criteria: Correctness (50%), Robustness (20%), Code Quality (20%), Complexity (10%)
    crit1 = RubricCriterion(
        rubric_id=rubric.id, title="Correctness", category=EvidenceCategory.CORRECTNESS,
        evaluation_type=EvaluationType.AUTOMATED_TEST, weight_percentage=50.0, max_points=5.0, order_index=0
    )
    crit2 = RubricCriterion(
        rubric_id=rubric.id, title="Robustness", category=EvidenceCategory.ROBUSTNESS,
        evaluation_type=EvaluationType.AUTOMATED_TEST, weight_percentage=20.0, max_points=2.0, order_index=1
    )
    crit3 = RubricCriterion(
        rubric_id=rubric.id, title="Code Quality", category=EvidenceCategory.CODE_QUALITY,
        evaluation_type=EvaluationType.CODE_QUALITY, weight_percentage=20.0, max_points=2.0, order_index=2,
        config={"penalty_per_error": 0.5, "penalty_per_warning": 0.1}
    )
    crit4 = RubricCriterion(
        rubric_id=rubric.id, title="Complexity", category=EvidenceCategory.COMPLEXITY,
        evaluation_type=EvaluationType.STRUCTURAL_COMPLEXITY, weight_percentage=10.0, max_points=1.0, order_index=3,
        config={"penalty_per_violation": 0.5}
    )
    db.add_all([crit1, crit2, crit3, crit4])
    db.flush()

    # Create submission
    sub = Submission(
        assignment_id=assignment.id, student_identifier="SV1001", student_name="Student One",
        original_filename="solution.py", storage_key="fake-storage-key.py", size_bytes=100, sha256="abc"
    )
    db.add(sub)
    db.flush()

    # Add evidence:
    # Correctness: 4 public tests (3 passed, 1 failed) -> 75% -> 3.75 / 5.0
    for i in range(3):
        db.add(SubmissionEvidence(
            id=f"ev-pub-pass-{i}", submission_id=sub.id, assignment_id=assignment.id,
            source=EvidenceSource.PYTEST, category=EvidenceCategory.CORRECTNESS, severity=EvidenceSeverity.INFO,
            rule_code="TEST_PASSED", message="Passed"
        ))
    db.add(SubmissionEvidence(
        id="ev-pub-fail-1", submission_id=sub.id, assignment_id=assignment.id,
        source=EvidenceSource.PYTEST, category=EvidenceCategory.CORRECTNESS, severity=EvidenceSeverity.ERROR,
        rule_code="AssertionError", message="Failed"
    ))

    # Robustness: 2 hidden tests (both passed) -> 100% -> 2.0 / 2.0
    for i in range(2):
        db.add(SubmissionEvidence(
            id=f"ev-hid-pass-{i}", submission_id=sub.id, assignment_id=assignment.id,
            source=EvidenceSource.PYTEST, category=EvidenceCategory.ROBUSTNESS, severity=EvidenceSeverity.INFO,
            rule_code="TEST_PASSED", message="Passed"
        ))

    # Code Quality: 2 Ruff warnings -> 2 * 0.1 = 0.2 deduction -> 1.8 / 2.0
    for i in range(2):
        db.add(SubmissionEvidence(
            id=f"ev-ruff-{i}", submission_id=sub.id, assignment_id=assignment.id,
            source=EvidenceSource.RUFF, category=EvidenceCategory.CODE_QUALITY, severity=EvidenceSeverity.WARNING,
            rule_code="F401", message="Unused import"
        ))

    # Complexity: 1 AST violation -> 1 * 0.5 = 0.5 deduction -> 0.5 / 1.0
    db.add(SubmissionEvidence(
        id="ev-ast-1", submission_id=sub.id, assignment_id=assignment.id,
        source=EvidenceSource.AST, category=EvidenceCategory.COMPLEXITY, severity=EvidenceSeverity.WARNING,
        rule_code="HIGH_CYCLOMATIC_COMPLEXITY", message="CC too high"
    ))
    db.commit()

    # Evaluate Grade
    grade = evaluate_submission_grade(db, sub.id)
    assert grade is not None

    # Expected: 3.75 + 2.0 + 1.8 + 0.5 = 8.05
    assert grade.suggested_total_score == 8.05
    assert grade.final_total_score == 8.05
    assert len(grade.criterion_scores) == 4

    scores_by_title = {cs.criterion.title: cs.suggested_score for cs in grade.criterion_scores}
    assert scores_by_title["Correctness"] == 3.75
    assert scores_by_title["Robustness"] == 2.0
    assert scores_by_title["Code Quality"] == 1.8
    assert scores_by_title["Complexity"] == 0.5


def test_rubric_api_and_gradebook_export(client, lecturer_token, lecturer_user, db):
    headers = {"Authorization": f"Bearer {lecturer_token}"}

    course = Course(code="CS-API-RUBRIC", name="Course API Rubric", instructor_id=lecturer_user.id)
    db.add(course)
    db.flush()

    cohort = Cohort(code="ARC1", name="Cohort ARC1", semester="Spring", year=2026, course_id=course.id)
    db.add(cohort)
    db.flush()

    assignment = Assignment(class_id=cohort.id, title="API Rubric Assignment", status=AssignmentStatus.PUBLISHED)
    db.add(assignment)
    db.flush()

    # 1. Create rubric via API
    rubric_payload = {
        "title": "Grading Rubric",
        "description": "Grading criteria for assignment",
        "max_score": 10.0,
        "criteria": [
            {
                "title": "Automated Tests",
                "category": "correctness",
                "evaluation_type": "automated_test",
                "weight_percentage": 70.0,
            },
            {
                "title": "Code Cleanliness",
                "category": "code_quality",
                "evaluation_type": "code_quality",
                "weight_percentage": 30.0,
            },
        ],
    }
    create_resp = client.post(
        f"/api/v1/courses/{course.id}/classes/{cohort.id}/assignments/{assignment.id}/rubric",
        headers=headers,
        json=rubric_payload,
    )
    assert create_resp.status_code == 200
    rubric_data = create_resp.json()
    assert rubric_data["title"] == "Grading Rubric"
    assert len(rubric_data["criteria"]) == 2
    crit_id_test = rubric_data["criteria"][0]["id"]

    # 2. Add submission & evidence
    sub = Submission(
        assignment_id=assignment.id, student_identifier="SV9999", student_name="Alice Smith",
        original_filename="main.py", storage_key="storage-test-rubric.py", size_bytes=50, sha256="123"
    )
    db.add(sub)
    db.flush()

    db.add(SubmissionEvidence(
        id="ev-api-pass", submission_id=sub.id, assignment_id=assignment.id,
        source=EvidenceSource.PYTEST, category=EvidenceCategory.CORRECTNESS, severity=EvidenceSeverity.INFO,
        rule_code="TEST_PASSED", message="Passed"
    ))
    db.commit()

    # 3. Evaluate Grade via API
    eval_resp = client.post(
        f"/api/v1/courses/{course.id}/classes/{cohort.id}/assignments/{assignment.id}/submissions/{sub.id}/evaluate-grade",
        headers=headers,
    )
    assert eval_resp.status_code == 200
    eval_data = eval_resp.json()
    # 70% of 10.0 is 7.0 for tests, 30% of 10.0 is 3.0 for clean code -> total 10.0
    assert eval_data["suggested_total_score"] == 10.0

    # 4. Override grade via API
    override_payload = {
        "final_total_score": 9.5,
        "status": "confirmed",
        "feedback_summary": "Solid submission with minor improvement potential",
        "criterion_overrides": [
            {
                "criterion_id": crit_id_test,
                "final_score": 6.5,
                "justification": "Deducted 0.5 for poor algorithm efficiency",
            }
        ],
    }
    put_resp = client.put(
        f"/api/v1/courses/{course.id}/classes/{cohort.id}/assignments/{assignment.id}/submissions/{sub.id}/grade",
        headers=headers,
        json=override_payload,
    )
    assert put_resp.status_code == 200
    grade_data = put_resp.json()
    assert grade_data["final_total_score"] == 9.5
    assert grade_data["status"] == "confirmed"

    # 5. Export Gradebook CSV via API
    csv_resp = client.get(
        f"/api/v1/courses/{course.id}/classes/{cohort.id}/assignments/{assignment.id}/gradebook-csv",
        headers=headers,
    )
    assert csv_resp.status_code == 200
    assert "text/csv" in csv_resp.headers["content-type"]
    csv_text = csv_resp.text
    reader = csv.reader(io.StringIO(csv_text))
    rows = list(reader)
    assert len(rows) == 2  # Header + 1 submission
    header = rows[0]
    assert "Student Identifier" in header
    assert "Automated Tests (Max 7.0)" in header
    assert "Final Score" in header
    assert rows[1][1] == "SV9999"
    assert rows[1][2] == "Alice Smith"
