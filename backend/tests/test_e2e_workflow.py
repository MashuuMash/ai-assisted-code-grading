import csv
import io
import zipfile
from unittest.mock import MagicMock

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    EvidenceSource,
    GradingJob,
    GradingJobStatus,
    Submission,
    SubmissionEvidence,
    TestOutcome,
    User,
)
from app.sandbox_runner import SandboxResult, SandboxTestResult
from app.worker import process_job
from tests.conftest import auth_headers


def test_full_instructor_grading_lifecycle(
    client: TestClient,
    lecturer_user: User,
    lecturer_token: str,
    db: Session,
):
    headers = auth_headers(lecturer_token)

    # -------------------------------------------------------------------------
    # STEP 1: Course & Cohort Setup
    # -------------------------------------------------------------------------
    res_course = client.post(
        "/api/v1/courses",
        headers=headers,
        json={"code": "CS102-E2E", "name": "Data Structures and Algorithms"},
    )
    assert res_course.status_code == 201
    course_id = res_course.json()["id"]

    res_cohort = client.post(
        f"/api/v1/courses/{course_id}/classes",
        headers=headers,
        json={"code": "C01", "name": "Class C01", "semester": "Spring", "year": 2026},
    )
    assert res_cohort.status_code == 201
    cohort_id = res_cohort.json()["id"]

    # -------------------------------------------------------------------------
    # STEP 2: Assignment Setup with Base Code
    # -------------------------------------------------------------------------
    base_code_template = (
        "# Starter template provided by instructor\n"
        "def is_prime(n: int) -> bool:\n"
        "    \"\"\"Check if n is prime.\"\"\"\n"
        "    pass\n\n"
        "def fibonacci(n: int) -> int:\n"
        "    \"\"\"Calculate nth Fibonacci number.\"\"\"\n"
        "    pass\n"
    )

    res_assignment = client.post(
        f"/api/v1/courses/{course_id}/classes/{cohort_id}/assignments",
        headers=headers,
        json={
            "title": "Assignment 1: Prime and Fibonacci Analysis",
            "instructions": "Implement is_prime and fibonacci according to the specifications.",
            "language": "python",
            "base_code": base_code_template,
            "status": "published",
        },
    )
    assert res_assignment.status_code == 201
    assignment_id = res_assignment.json()["id"]

    base_url = f"/api/v1/courses/{course_id}/classes/{cohort_id}/assignments/{assignment_id}"

    # -------------------------------------------------------------------------
    # STEP 3: Rubric Creation with 100% Weight Validation
    # -------------------------------------------------------------------------
    rubric_payload = {
        "title": "Assignment 1 Comprehensive Rubric",
        "max_score": 10.0,
        "criteria": [
            {
                "title": "Test Correctness",
                "category": "correctness",
                "evaluation_type": "automated_test",
                "weight_percentage": 40.0,
                "max_points": 4.0,
                "order_index": 0,
            },
            {
                "title": "Edge Cases & Robustness",
                "category": "robustness",
                "evaluation_type": "automated_test",
                "weight_percentage": 20.0,
                "max_points": 2.0,
                "order_index": 1,
            },
            {
                "title": "Code Quality (Linter)",
                "category": "code_quality",
                "evaluation_type": "code_quality",
                "weight_percentage": 20.0,
                "max_points": 2.0,
                "order_index": 2,
                "config": {"penalty_per_error": 0.5, "penalty_per_warning": 0.2},
            },
            {
                "title": "Structural Complexity",
                "category": "complexity",
                "evaluation_type": "structural_complexity",
                "weight_percentage": 20.0,
                "max_points": 2.0,
                "order_index": 3,
                "config": {"penalty_per_violation": 0.5},
            },
        ],
    }

    res_rubric = client.post(f"{base_url}/rubric", headers=headers, json=rubric_payload)
    assert res_rubric.status_code in (200, 201)
    rubric_data = res_rubric.json()
    assert len(rubric_data["criteria"]) == 4

    # -------------------------------------------------------------------------
    # STEP 4: Test Cases Setup (2 Public, 2 Hidden)
    # -------------------------------------------------------------------------
    tc_data = [
        {"name": "test_prime_public", "visibility": "public", "content": "assert is_prime(2) is True"},
        {"name": "test_fib_public", "visibility": "public", "content": "assert fibonacci(5) == 5"},
        {"name": "test_prime_hidden", "visibility": "hidden", "content": "assert is_prime(-5) is False"},
        {"name": "test_fib_hidden", "visibility": "hidden", "content": "assert fibonacci(10) == 55"},
    ]
    created_tc_ids = []
    for tc in tc_data:
        res_tc = client.post(f"{base_url}/test-cases", headers=headers, json=tc)
        assert res_tc.status_code == 201
        created_tc_ids.append(res_tc.json()["id"])
    assert len(created_tc_ids) == 4

    # -------------------------------------------------------------------------
    # STEP 5: Batch Ingestion of LMS Archive (Moodle Format, 3 Students)
    # -------------------------------------------------------------------------
    # Student 1001: Clean, correct implementation
    code_1001 = (
        "def is_prime(n: int) -> bool:\n"
        "    if n < 2:\n"
        "        return False\n"
        "    for i in range(2, int(n**0.5) + 1):\n"
        "        if n % i == 0:\n"
        "            return False\n"
        "    return True\n\n"
        "def fibonacci(n: int) -> int:\n"
        "    if n <= 0:\n"
        "        return 0\n"
        "    if n == 1:\n"
        "        return 1\n"
        "    a, b = 0, 1\n"
        "    for _ in range(2, n + 1):\n"
        "        a, b = b, a + b\n"
        "    return b\n"
    )

    # Student 1002: Has unused imports, deep nesting, fails edge cases
    code_1002 = (
        "import math\n"
        "import sys\n\n"
        "def is_prime(n: int) -> bool:\n"
        "    for i in range(2, n):\n"
        "        if n % i == 0:\n"
        "            return False\n"
        "    return True\n\n"
        "def fibonacci(n: int) -> int:\n"
        "    if n < 0:\n"
        "        return -1\n"
        "    total = 0\n"
        "    if n > 0:\n"
        "        if n > 1:\n"
        "            if n > 2:\n"
        "                if n > 3:\n"
        "                    if n > 4:\n"
        "                        total = 5\n"
        "    return total\n"
    )

    # Student 1003: Plagiarized/adapted from 1001 with renamed identifiers
    code_1003 = (
        "def is_prime(number: int) -> bool:\n"
        "    if number < 2:\n"
        "        return False\n"
        "    for divisor in range(2, int(number**0.5) + 1):\n"
        "        if number % divisor == 0:\n"
        "            return False\n"
        "    return True\n\n"
        "def fibonacci(count: int) -> int:\n"
        "    if count <= 0:\n"
        "        return 0\n"
        "    if count == 1:\n"
        "        return 1\n"
        "    val_x, val_y = 0, 1\n"
        "    for _ in range(2, count + 1):\n"
        "        val_x, val_y = val_y, val_x + val_y\n"
        "    return val_y\n"
    )

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("Nguyen Van An_1001_assignsubmission_file_main.py", code_1001)
        zf.writestr("Tran Thi Binh_1002_assignsubmission_file_main.py", code_1002)
        zf.writestr("Le Van Cuong_1003_assignsubmission_file_main.py", code_1003)
    zip_buffer.seek(0)

    res_batch = client.post(
        f"{base_url}/submissions/batch-zip",
        headers=headers,
        files={"file": ("submissions.zip", zip_buffer, "application/zip")},
    )
    assert res_batch.status_code in (200, 201)
    batch_json = res_batch.json()
    assert batch_json["total_found"] == 3
    assert batch_json["imported_count"] == 3
    assert batch_json["failed_count"] == 0

    # Retrieve created submissions
    subs = list(
        db.scalars(
            select(Submission)
            .where(Submission.assignment_id == assignment_id)
            .order_by(Submission.student_identifier)
        )
    )
    assert len(subs) == 3
    sub_1001, sub_1002, sub_1003 = subs[0], subs[1], subs[2]
    assert sub_1001.student_identifier == "1001"
    assert sub_1002.student_identifier == "1002"
    assert sub_1003.student_identifier == "1003"

    # -------------------------------------------------------------------------
    # STEP 6: Worker Execution & Pipeline Processing
    # -------------------------------------------------------------------------
    jobs = list(
        db.scalars(
            select(GradingJob)
            .where(GradingJob.submission_id.in_([s.id for s in subs]))
            .order_by(GradingJob.submission_id)
        )
    )
    assert len(jobs) == 3

    # Define mock outcomes per student
    # Student 1001: All 4 tests passed
    runner_1001 = MagicMock()
    runner_1001.run.return_value = SandboxResult(
        timed_out=False,
        infrastructure_error=None,
        runtime_ms=120,
        output="4 passed in 0.12s",
        results=[
            SandboxTestResult(
                test_case_id=created_tc_ids[0], test_name="test_prime_public",
                outcome=TestOutcome.PASSED, duration_ms=25, failure_type=None, failure_detail=None
            ),
            SandboxTestResult(
                test_case_id=created_tc_ids[1], test_name="test_fib_public",
                outcome=TestOutcome.PASSED, duration_ms=25, failure_type=None, failure_detail=None
            ),
            SandboxTestResult(
                test_case_id=created_tc_ids[2], test_name="test_prime_hidden",
                outcome=TestOutcome.PASSED, duration_ms=30, failure_type=None, failure_detail=None
            ),
            SandboxTestResult(
                test_case_id=created_tc_ids[3], test_name="test_fib_hidden",
                outcome=TestOutcome.PASSED, duration_ms=40, failure_type=None, failure_detail=None
            ),
        ],
    )

    # Student 1002: 2 public passed, 2 hidden failed
    runner_1002 = MagicMock()
    runner_1002.run.return_value = SandboxResult(
        timed_out=False,
        infrastructure_error=None,
        runtime_ms=110,
        output="2 passed, 2 failed in 0.11s",
        results=[
            SandboxTestResult(
                test_case_id=created_tc_ids[0], test_name="test_prime_public",
                outcome=TestOutcome.PASSED, duration_ms=20, failure_type=None, failure_detail=None
            ),
            SandboxTestResult(
                test_case_id=created_tc_ids[1], test_name="test_fib_public",
                outcome=TestOutcome.PASSED, duration_ms=20, failure_type=None, failure_detail=None
            ),
            SandboxTestResult(
                test_case_id=created_tc_ids[2], test_name="test_prime_hidden",
                outcome=TestOutcome.FAILED, duration_ms=35, failure_type="AssertionError",
                failure_detail="assert is_prime(-5) is False\nAssertionError"
            ),
            SandboxTestResult(
                test_case_id=created_tc_ids[3], test_name="test_fib_hidden",
                outcome=TestOutcome.FAILED, duration_ms=35, failure_type="AssertionError",
                failure_detail="assert fibonacci(10) == 55\nAssertionError"
            ),
        ],
    )

    # Student 1003: All 4 tests passed
    runner_1003 = MagicMock()
    runner_1003.run.return_value = SandboxResult(
        timed_out=False,
        infrastructure_error=None,
        runtime_ms=115,
        output="4 passed in 0.11s",
        results=[
            SandboxTestResult(
                test_case_id=created_tc_ids[0], test_name="test_prime_public",
                outcome=TestOutcome.PASSED, duration_ms=25, failure_type=None, failure_detail=None
            ),
            SandboxTestResult(
                test_case_id=created_tc_ids[1], test_name="test_fib_public",
                outcome=TestOutcome.PASSED, duration_ms=25, failure_type=None, failure_detail=None
            ),
            SandboxTestResult(
                test_case_id=created_tc_ids[2], test_name="test_prime_hidden",
                outcome=TestOutcome.PASSED, duration_ms=30, failure_type=None, failure_detail=None
            ),
            SandboxTestResult(
                test_case_id=created_tc_ids[3], test_name="test_fib_hidden",
                outcome=TestOutcome.PASSED, duration_ms=35, failure_type=None, failure_detail=None
            ),
        ],
    )

    # Mark jobs as RUNNING before worker processing
    jobs[0].status = GradingJobStatus.RUNNING
    jobs[1].status = GradingJobStatus.RUNNING
    jobs[2].status = GradingJobStatus.RUNNING
    db.commit()

    # Process all 3 jobs
    process_job(jobs[0].id, runner=runner_1001, db=db)
    process_job(jobs[1].id, runner=runner_1002, db=db)
    process_job(jobs[2].id, runner=runner_1003, db=db)

    # Verify jobs completed
    for job in jobs:
        db.refresh(job)
        assert job.status == GradingJobStatus.COMPLETED

    # -------------------------------------------------------------------------
    # STEP 7: Verify Evidence Engine & Deterministic Rubric Scoring
    # -------------------------------------------------------------------------
    # Check Student 1001 Grade (clean code, 4/4 passed)
    res_grade_1001 = client.get(f"{base_url}/submissions/{sub_1001.id}/grade", headers=headers)
    assert res_grade_1001.status_code == 200
    grade_1001 = res_grade_1001.json()
    assert grade_1001["suggested_total_score"] == 10.0
    assert grade_1001["status"] in ("pending", "draft")

    # Check Student 1002 Grade (has deductions)
    res_grade_1002 = client.get(f"{base_url}/submissions/{sub_1002.id}/grade", headers=headers)
    assert res_grade_1002.status_code == 200
    grade_1002 = res_grade_1002.json()
    # Score must be lower than 10.0 due to test failures + Ruff + AST deductions
    assert grade_1002["suggested_total_score"] < 7.0

    # Verify evidence items for Student 1002
    res_ev_1002 = client.get(f"{base_url}/submissions/{sub_1002.id}/evidence", headers=headers)
    assert res_ev_1002.status_code == 200
    ev_1002_list = res_ev_1002.json()
    ev_sources = [item["source"] for item in ev_1002_list]
    assert "pytest" in ev_sources
    assert "ruff" in ev_sources
    assert "ast" in ev_sources

    # Check Student 1003 Grade (clean code, 4/4 passed)
    res_grade_1003 = client.get(f"{base_url}/submissions/{sub_1003.id}/grade", headers=headers)
    assert res_grade_1003.status_code == 200
    grade_1003 = res_grade_1003.json()
    assert grade_1003["suggested_total_score"] == 10.0

    # -------------------------------------------------------------------------
    # STEP 8: JPlag Academic Integrity & Similarity Analysis
    # -------------------------------------------------------------------------
    res_sim_run = client.post(
        f"{base_url}/similarity/run",
        headers=headers,
        json={"threshold": 50.0},
    )
    assert res_sim_run.status_code == 200
    sim_report_id = res_sim_run.json()["id"]

    # Verify similarity report details
    res_sim_rep = client.get(f"{base_url}/similarity/reports/{sim_report_id}", headers=headers)
    assert res_sim_rep.status_code == 200
    rep_data = res_sim_rep.json()
    assert rep_data["status"] == "completed"
    assert rep_data["submission_count"] == 3
    assert len(rep_data["comparisons"]) >= 1

    # Student 1001 and 1003 should be flagged with high similarity
    suspect_comparison = None
    for comp in rep_data["comparisons"]:
        pair_ids = {comp["submission_a_id"], comp["submission_b_id"]}
        if pair_ids == {sub_1001.id, sub_1003.id}:
            suspect_comparison = comp
            break
    assert suspect_comparison is not None
    assert suspect_comparison["similarity_percentage"] >= 50.0

    # Instructor reviews and flags the comparison
    res_review = client.put(
        f"{base_url}/similarity/reports/{sim_report_id}/comparisons/{suspect_comparison['id']}",
        headers=headers,
        json={
            "status": "flagged",
            "review_notes": "Suspected uncredited collaboration between Student 1001 and 1003.",
        },
    )
    assert res_review.status_code == 200
    assert res_review.json()["status"] == "flagged"
    assert "collaboration" in res_review.json()["review_notes"]

    # Verify JPlag evidence created for the flagged pair
    jplag_ev_1001 = list(
        db.scalars(
            select(SubmissionEvidence).where(
                SubmissionEvidence.submission_id == sub_1001.id,
                SubmissionEvidence.source == EvidenceSource.JPLAG,
            )
        )
    )
    assert len(jplag_ev_1001) >= 1

    # -------------------------------------------------------------------------
    # STEP 9: Evidence-Grounded AI Feedback Generation
    # -------------------------------------------------------------------------
    res_fb_gen = client.post(
        f"{base_url}/submissions/{sub_1002.id}/feedback/generate",
        headers=headers,
    )
    assert res_fb_gen.status_code == 200
    fb_data = res_fb_gen.json()
    assert fb_data["status"] in ("draft", "confirmed")
    assert "feedback_summary" in fb_data
    assert fb_data["detailed_feedback"] is not None

    detailed = fb_data["detailed_feedback"]
    assert "strengths" in detailed
    assert "areas_for_improvement" in detailed
    assert "citations" in detailed

    # Grounding check: verify all returned citations exist in submission_evidence
    db_ev_ids = {
        ev.id
        for ev in db.scalars(
            select(SubmissionEvidence).where(SubmissionEvidence.submission_id == sub_1002.id)
        )
    }
    for citation in detailed["citations"]:
        assert citation in db_ev_ids

    # -------------------------------------------------------------------------
    # STEP 10: Instructor Review & Score Override
    # -------------------------------------------------------------------------
    # Instructor overrides Student 1002's score
    override_payload = {
        "final_total_score": 6.5,
        "status": "confirmed",
        "feedback_summary": "Adjusted score after manual code review. Good effort on public tests.",
    }
    res_override = client.put(
        f"{base_url}/submissions/{sub_1002.id}/grade",
        headers=headers,
        json=override_payload,
    )
    assert res_override.status_code == 200
    grade_1002_updated = res_override.json()
    assert grade_1002_updated["final_total_score"] == 6.5
    assert grade_1002_updated["status"] == "confirmed"

    # Instructor confirms Student 1001's grade
    res_fb_1001_confirm = client.put(
        f"{base_url}/submissions/{sub_1001.id}/feedback",
        headers=headers,
        json={
            "feedback_summary": "Excellent submission! All test cases passed with clean code structure.",
            "status": "confirmed",
        },
    )
    assert res_fb_1001_confirm.status_code == 200
    assert res_fb_1001_confirm.json()["status"] == "confirmed"

    # -------------------------------------------------------------------------
    # STEP 11: Gradebook CSV Export
    # -------------------------------------------------------------------------
    res_csv = client.get(f"{base_url}/gradebook-csv", headers=headers)
    assert res_csv.status_code == 200
    assert "text/csv" in res_csv.headers.get("content-type", "")

    csv_text = res_csv.text
    reader = csv.reader(io.StringIO(csv_text))
    rows = list(reader)

    # Check header
    assert len(rows) >= 4  # 1 header + 3 student rows
    header = rows[0]
    assert "Student Identifier" in header
    assert "Final Score" in header
    assert "Status" in header

    # Validate student entries
    id_idx = header.index("Student Identifier")
    student_rows = {r[id_idx]: r for r in rows[1:]}
    assert "1001" in student_rows
    assert "1002" in student_rows
    assert "1003" in student_rows

    # 1001 confirmed with 10.0
    row_1001 = student_rows["1001"]
    status_idx = header.index("Status")
    score_idx = header.index("Final Score")
    assert row_1001[status_idx] == "confirmed"
    assert float(row_1001[score_idx]) == 10.0

    # 1002 confirmed with overridden score 6.5
    row_1002 = student_rows["1002"]
    assert row_1002[status_idx] == "confirmed"
    assert float(row_1002[score_idx]) == 6.5
