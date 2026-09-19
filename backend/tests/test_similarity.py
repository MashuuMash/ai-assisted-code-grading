from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.jplag_runner import (
    calculate_token_similarity,
    compute_winnowing_fingerprints,
    extract_kgrams,
    run_similarity_for_assignment,
    tokenize_python_code,
)
from app.models import (
    Assignment,
    AssignmentStatus,
    Cohort,
    Course,
    EvidenceCategory,
    EvidenceSeverity,
    EvidenceSource,
    SimilarityStatus,
    Submission,
    SubmissionEvidence,
    User,
    UserRole,
)
from app.submission_storage import SubmissionStorage
from tests.conftest import auth_headers


def test_tokenize_python_code_normalizes_identifiers_and_literals():
    code = """
def calculate_sum(val_a, val_b):
    # Calculate sum of two variables
    total = val_a + val_b
    return total
"""
    tokens = tokenize_python_code(code)
    assert len(tokens) > 0

    token_kinds = [t.kind for t in tokens]
    # Function name and parameters are normalized to ID
    assert "def" in token_kinds
    assert "return" in token_kinds
    assert "+" in token_kinds
    assert "ID" in token_kinds
    # Comments are stripped
    assert not any("Calculate sum" in t.kind for t in tokens)


def test_tokenize_python_code_handles_syntax_errors():
    malformed_code = "def broken(:\n    return &&"
    tokens = tokenize_python_code(malformed_code)
    assert len(tokens) > 0
    assert any(t.kind == "def" for t in tokens)


def test_extract_kgrams_and_winnowing():
    tokens = tokenize_python_code("def foo(x):\n    return x * 2\n")
    kgrams = extract_kgrams(tokens, k=3)
    assert len(kgrams) > 0
    for kg in kgrams:
        assert len(kg.hash_val) == 64
        assert kg.start_line >= 1
        assert kg.end_line >= kg.start_line

    fps = compute_winnowing_fingerprints(kgrams, window_size=3)
    assert len(fps) > 0
    assert len(fps) <= len(kgrams)


def test_similarity_identical_and_renamed_code():
    code_a = """
def solve_problem(n):
    result = []
    for item in range(n):
        if item % 2 == 0:
            result.append(item * item)
    return result
"""
    # Same logic with renamed variables and extra whitespace/comments
    code_b = """
def solve_problem(count):
    # Initialize output array
    output = []
    for val in range(count):
        if val % 2 == 0:
            output.append(val * val)
    return output
"""
    result = calculate_token_similarity(code_a, code_b)
    assert result.similarity_percentage >= 80.0
    assert result.matched_tokens > 0
    assert len(result.matched_regions) > 0


def test_similarity_different_code():
    code_a = """
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)
"""
    code_b = """
def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(0, n - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr
"""
    result = calculate_token_similarity(code_a, code_b)
    assert result.similarity_percentage < 30.0


def test_base_code_subtraction_prevents_false_positives():
    starter_template = """
def compute_metrics(dataset):
    # Template starter skeleton provided by instructor
    pass
"""
    student_a_code = """
def compute_metrics(dataset):
    # Template starter skeleton provided by instructor
    total = sum(dataset)
    return total / len(dataset)
"""
    student_b_code = """
def compute_metrics(dataset):
    # Template starter skeleton provided by instructor
    sorted_data = sorted(dataset)
    mid = len(sorted_data) // 2
    return sorted_data[mid]
"""
    # Without base-code subtraction, template header matches
    raw_match = calculate_token_similarity(student_a_code, student_b_code, base_source=None)

    # With base-code subtraction, template header is excluded
    subtracted_match = calculate_token_similarity(student_a_code, student_b_code, base_source=starter_template)

    assert subtracted_match.similarity_percentage <= raw_match.similarity_percentage


def test_similarity_analysis_flow_and_evidence_generation(
    db: Session, client: TestClient, lecturer_token: str, student_token: str, lecturer_user: User
):
    # 1. Setup course, class, assignment
    course = Course(code="CS-SIM", name="Similarity Course", instructor_id=lecturer_user.id)
    db.add(course)
    db.flush()

    cohort = Cohort(code="SIM1", name="Cohort SIM1", semester="Fall", year=2026, course_id=course.id)
    db.add(cohort)
    db.flush()

    base_code = "def solve(data):\n    pass\n"
    assignment = Assignment(
        class_id=cohort.id,
        title="Similarity Assignment",
        status=AssignmentStatus.PUBLISHED,
        base_code=base_code,
    )
    db.add(assignment)
    db.flush()

    # 2. Setup 3 students and their stored submissions
    s1 = User(email="s1@sim.edu", username="s1", full_name="Student 1", hashed_password="x", role=UserRole.STUDENT)
    s2 = User(email="s2@sim.edu", username="s2", full_name="Student 2", hashed_password="x", role=UserRole.STUDENT)
    s3 = User(email="s3@sim.edu", username="s3", full_name="Student 3", hashed_password="x", role=UserRole.STUDENT)
    db.add_all([s1, s2, s3])
    db.flush()

    storage = SubmissionStorage()
    code_copied_1 = b"""
def solve(data):
    acc = 0
    for item in data:
        if item > 0:
            acc += item
    return acc
"""
    code_copied_2 = b"""
def solve(data):
    # Renamed variable
    total = 0
    for num in data:
        if num > 0:
            total += num
    return total
"""
    code_distinct = b"""
def solve(data):
    return [x for x in data if x % 2 == 0]
"""

    stored_1 = storage.store_bytes(code_copied_1, "solution.py")
    stored_2 = storage.store_bytes(code_copied_2, "solution.py")
    stored_3 = storage.store_bytes(code_distinct, "solution.py")

    sub1 = Submission(
        assignment_id=assignment.id,
        student_id=s1.id,
        original_filename="solution.py",
        storage_key=stored_1.storage_key,
        size_bytes=stored_1.size_bytes,
        sha256=stored_1.sha256,
    )
    sub2 = Submission(
        assignment_id=assignment.id,
        student_id=s2.id,
        original_filename="solution.py",
        storage_key=stored_2.storage_key,
        size_bytes=stored_2.size_bytes,
        sha256=stored_2.sha256,
    )
    sub3 = Submission(
        assignment_id=assignment.id,
        student_id=s3.id,
        original_filename="solution.py",
        storage_key=stored_3.storage_key,
        size_bytes=stored_3.size_bytes,
        sha256=stored_3.sha256,
    )
    db.add_all([sub1, sub2, sub3])
    db.commit()

    base_url = f"/api/v1/courses/{course.id}/classes/{cohort.id}/assignments/{assignment.id}/similarity"

    # 3. Student cannot trigger similarity run
    res_student = client.post(
        f"{base_url}/run",
        json={"threshold": 50.0},
        headers=auth_headers(student_token),
    )
    assert res_student.status_code == 403

    # 4. Lecturer triggers similarity run
    res_run = client.post(
        f"{base_url}/run",
        json={"threshold": 50.0},
        headers=auth_headers(lecturer_token),
    )
    assert res_run.status_code == 200
    report_data = res_run.json()
    assert report_data["status"] == "completed"
    assert report_data["submission_count"] == 3
    assert report_data["max_similarity"] >= 80.0
    report_id = report_data["id"]

    # 5. Check Evidence was generated for the high-similarity pair
    evidence_records = db.scalars(
        select(SubmissionEvidence)
        .where(
            SubmissionEvidence.assignment_id == assignment.id,
            SubmissionEvidence.source == EvidenceSource.JPLAG,
            SubmissionEvidence.category == EvidenceCategory.SIMILARITY,
        )
    ).all()
    # At least two evidence records (one for sub1, one for sub2)
    assert len(evidence_records) >= 2
    for ev in evidence_records:
        assert ev.rule_code == "HIGH_SIMILARITY_DETECTED"
        assert ev.severity in (EvidenceSeverity.WARNING, EvidenceSeverity.ERROR)
        assert ev.metric_value >= 50.0

    # 6. List reports
    res_list = client.get(f"{base_url}/reports", headers=auth_headers(lecturer_token))
    assert res_list.status_code == 200
    reports = res_list.json()
    assert len(reports) == 1
    assert reports[0]["id"] == report_id

    # 7. Get detailed report with pairwise comparisons
    res_detail = client.get(f"{base_url}/reports/{report_id}", headers=auth_headers(lecturer_token))
    assert res_detail.status_code == 200
    detail = res_detail.json()
    assert "comparisons" in detail
    comparisons = detail["comparisons"]
    # 3 submissions -> 3 pairwise comparisons: (1, 2), (1, 3), (2, 3)
    assert len(comparisons) == 3

    # The pair between sub1 and sub2 should be ranked highest
    top_pair = comparisons[0]
    assert top_pair["similarity_percentage"] >= 80.0
    assert top_pair["status"] == "unreviewed"
    comp_id = top_pair["id"]

    # 8. Lecturer review: Flag candidate comparison
    res_flag = client.put(
        f"{base_url}/reports/{report_id}/comparisons/{comp_id}",
        json={
            "status": "flagged",
            "review_notes": "Identical logic detected, both students flagged for interview.",
        },
        headers=auth_headers(lecturer_token),
    )
    assert res_flag.status_code == 200
    updated_comp = res_flag.json()
    assert updated_comp["status"] == "flagged"
    assert "both students flagged" in updated_comp["review_notes"]

    # 9. Lecturer review: Dismiss candidate comparison
    res_dismiss = client.put(
        f"{base_url}/reports/{report_id}/comparisons/{comp_id}",
        json={"status": "dismissed", "review_notes": "Reviewed and verified false positive"},
        headers=auth_headers(lecturer_token),
    )
    assert res_dismiss.status_code == 200
    assert res_dismiss.json()["status"] == "dismissed"

    # 10. Student cannot view report details
    res_student_view = client.get(
        f"{base_url}/reports/{report_id}",
        headers=auth_headers(student_token),
    )
    assert res_student_view.status_code == 403


def test_similarity_graceful_handling_few_submissions(
    db: Session, lecturer_user: User
):
    course = Course(code="CS-FEW", name="Few Submissions Course", instructor_id=lecturer_user.id)
    db.add(course)
    db.flush()

    cohort = Cohort(code="FEW1", name="Cohort FEW1", semester="Fall", year=2026, course_id=course.id)
    db.add(cohort)
    db.flush()

    assignment = Assignment(class_id=cohort.id, title="Few Submissions Assignment", status=AssignmentStatus.PUBLISHED)
    db.add(assignment)
    db.flush()

    # 0 submissions
    report = run_similarity_for_assignment(assignment_id=assignment.id, db=db, threshold=50.0)
    assert report.status == SimilarityStatus.COMPLETED
    assert report.submission_count == 0
    assert "At least 2 submissions" in (report.error_message or "")
