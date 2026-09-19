from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.codebert_detector import CodeBertDetector, CodeBertPrediction, generate_codebert_evidence
from app.models import (
    Assignment,
    AssignmentStatus,
    Cohort,
    Course,
    EvidenceCategory,
    EvidenceSeverity,
    EvidenceSource,
    Submission,
    SubmissionEvidence,
    User,
)
from app.submission_storage import SubmissionStorage
from tests.conftest import auth_headers


def test_codebert_detector_predict_basic():
    detector = CodeBertDetector()
    code = (
        "def solve_problem(items: list[int]) -> int:\n"
        "    \"\"\"Calculate total sum of positive integers.\"\"\"\n"
        "    total_sum = 0\n"
        "    for item in items:\n"
        "        if item > 0:\n"
        "            total_sum += item\n"
        "    return total_sum\n"
    )
    prediction = detector.predict(code)

    assert isinstance(prediction, CodeBertPrediction)
    assert 0.0 <= prediction.ai_probability <= 1.0
    assert 0.0 <= prediction.confidence_score <= 1.0
    assert prediction.classification in ("ai_generated", "human", "inconclusive")
    assert prediction.model_mode in ("transformers_codebert", "heuristic_statistical")
    assert len(prediction.signals) > 0


def test_codebert_detector_empty_source():
    detector = CodeBertDetector()
    prediction = detector.predict("")

    assert prediction.ai_probability == 0.0
    assert prediction.classification == "human"
    assert prediction.confidence_score == 1.0
    assert "Empty source code" in prediction.signals


def test_codebert_detector_syntax_error():
    detector = CodeBertDetector()
    malformed_code = "def broken(:\n    return &&"
    prediction = detector.predict(malformed_code)

    assert prediction.ai_probability <= 0.35
    assert prediction.classification == "human"
    assert any("Syntax error" in s for s in prediction.signals)


def test_codebert_generate_evidence():
    pred_high = CodeBertPrediction(
        ai_probability=0.88,
        classification="ai_generated",
        confidence_score=0.76,
        model_mode="heuristic_statistical",
        signals=["High lexical uniformity", "Standard docstring structure"],
    )
    ev_high = generate_codebert_evidence(submission_id=10, assignment_id=5, prediction=pred_high)
    assert len(ev_high) == 1
    assert ev_high[0].source == EvidenceSource.CODEBERT
    assert ev_high[0].category == EvidenceCategory.SIMILARITY
    assert ev_high[0].severity == EvidenceSeverity.WARNING
    assert ev_high[0].rule_code == "AI_CODE_PROBABILITY_HIGH"
    assert ev_high[0].metric_value == 0.88
    assert "88.0%" in ev_high[0].message

    pred_low = CodeBertPrediction(
        ai_probability=0.15,
        classification="human",
        confidence_score=0.70,
        model_mode="heuristic_statistical",
        signals=["Exploratory non-standard code idioms"],
    )
    ev_low = generate_codebert_evidence(submission_id=10, assignment_id=5, prediction=pred_low)
    assert len(ev_low) == 1
    assert ev_low[0].severity == EvidenceSeverity.INFO
    assert ev_low[0].rule_code == "AI_CODE_PROBABILITY_LOW"


def test_codebert_api_single_submission_and_persistence(
    db: Session,
    client: TestClient,
    lecturer_token: str,
    student_token: str,
    lecturer_user: User,
):
    course = Course(code="CS-CB1", name="CodeBERT Course", instructor_id=lecturer_user.id)
    db.add(course)
    db.flush()

    cohort = Cohort(code="CB1", name="Cohort CB1", semester="Spring", year=2026, course_id=course.id)
    db.add(cohort)
    db.flush()

    assignment = Assignment(
        class_id=cohort.id,
        title="CodeBERT Analysis Assignment",
        status=AssignmentStatus.PUBLISHED,
    )
    db.add(assignment)
    db.flush()

    storage = SubmissionStorage()
    stored = storage.store_bytes(
        b"def add_numbers(val_a: int, val_b: int) -> int:\n    \"\"\"Add two numbers.\"\"\"\n    return val_a + val_b\n",
        "addition.py",
    )

    submission = Submission(
        assignment_id=assignment.id,
        student_identifier="STU-CB-01",
        student_name="Test Student",
        original_filename="addition.py",
        storage_key=stored.storage_key,
        size_bytes=stored.size_bytes,
        sha256=stored.sha256,
    )
    db.add(submission)
    db.commit()

    base_url = f"/api/v1/courses/{course.id}/classes/{cohort.id}/assignments/{assignment.id}/submissions"

    # Student access denied (403)
    res_stud = client.post(
        f"{base_url}/{submission.id}/detect-ai",
        headers=auth_headers(student_token),
    )
    assert res_stud.status_code == 403

    # Lecturer triggers detection (200)
    res_lec = client.post(
        f"{base_url}/{submission.id}/detect-ai",
        headers=auth_headers(lecturer_token),
    )
    assert res_lec.status_code == 200
    data = res_lec.json()
    assert data["submission_id"] == submission.id
    assert 0.0 <= data["ai_probability"] <= 1.0
    assert data["classification"] in ("ai_generated", "human", "inconclusive")
    assert len(data["signals"]) > 0
    assert data["evidence_id"] is not None

    # Verify evidence persisted in DB
    ev_record = db.scalar(
        select(SubmissionEvidence).where(
            SubmissionEvidence.id == data["evidence_id"],
            SubmissionEvidence.source == EvidenceSource.CODEBERT,
        )
    )
    assert ev_record is not None
    assert ev_record.submission_id == submission.id
    assert ev_record.metric_value == data["ai_probability"]


def test_codebert_api_batch_detect(
    db: Session,
    client: TestClient,
    lecturer_token: str,
    lecturer_user: User,
):
    course = Course(code="CS-CB2", name="CodeBERT Batch Course", instructor_id=lecturer_user.id)
    db.add(course)
    db.flush()

    cohort = Cohort(code="CB2", name="Cohort CB2", semester="Spring", year=2026, course_id=course.id)
    db.add(cohort)
    db.flush()

    assignment = Assignment(
        class_id=cohort.id,
        title="Batch CodeBERT Assignment",
        status=AssignmentStatus.PUBLISHED,
    )
    db.add(assignment)
    db.flush()

    storage = SubmissionStorage()
    sub1_stored = storage.store_bytes(b"def func_a():\n    return 1\n", "a.py")
    sub2_stored = storage.store_bytes(b"def func_b():\n    return 2\n", "b.py")

    sub1 = Submission(
        assignment_id=assignment.id, student_identifier="STU-01",
        original_filename="a.py", storage_key=sub1_stored.storage_key,
        size_bytes=sub1_stored.size_bytes, sha256=sub1_stored.sha256,
    )
    sub2 = Submission(
        assignment_id=assignment.id, student_identifier="STU-02",
        original_filename="b.py", storage_key=sub2_stored.storage_key,
        size_bytes=sub2_stored.size_bytes, sha256=sub2_stored.sha256,
    )
    db.add_all([sub1, sub2])
    db.commit()

    base_url = f"/api/v1/courses/{course.id}/classes/{cohort.id}/assignments/{assignment.id}/submissions"

    res_batch = client.post(
        f"{base_url}/batch-detect-ai",
        headers=auth_headers(lecturer_token),
    )
    assert res_batch.status_code == 200
    batch_data = res_batch.json()
    assert batch_data["total_analyzed"] == 2
    assert len(batch_data["results"]) == 2
