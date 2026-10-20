import io
import zipfile
from concurrent.futures import ThreadPoolExecutor

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, func, select, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import (
    Assignment,
    Cohort,
    Course,
    CriterionScore,
    GradingJob,
    Rubric,
    RubricCriterion,
    SimilarityComparison,
    SimilarityReport,
    Submission,
    SubmissionEvidence,
    SubmissionGrade,
    TestCase,
    TestResult,
    User,
)
from tests.conftest import TestingSessionLocal, auth_headers


def test_demo_seed_endpoint_contract(client: TestClient) -> None:
    """Test POST /api/v1/demo/seed generates valid JWT, user, assignment, and sample submissions."""
    # 1. Seed demo environment without prior auth
    seed_res = client.post("/api/v1/demo/seed")
    assert seed_res.status_code == 200
    seed_data = seed_res.json()

    # Validate response structure
    assert "access_token" in seed_data
    assert seed_data["token_type"] == "bearer"
    assert len(seed_data["access_token"]) > 20

    user = seed_data["user"]
    assert user["username"] == "demo_lecturer"
    assert user["email"] == "demo_lecturer@university.edu"
    assert user["full_name"] == "Demo Lecturer"
    assert user["role"] == "lecturer"
    assert isinstance(user["id"], int)

    course_id = seed_data["course_id"]
    class_id = seed_data["class_id"]
    assignment_id = seed_data["assignment_id"]
    assert isinstance(course_id, int)
    assert isinstance(class_id, int)
    assert isinstance(assignment_id, int)

    sample_subs = seed_data["sample_submissions"]
    assert len(sample_subs) == 3

    # Student 1001: Perfect score 10.0, confirmed
    sub_1001 = next(s for s in sample_subs if s["student_code"] == "1001")
    assert sub_1001["student_name"] == "Nguyen Van An"
    assert sub_1001["grade_status"] == "confirmed"
    assert sub_1001["final_score"] == 10.0

    # Student 1002: Flawed submission, draft ~5.5
    sub_1002 = next(s for s in sample_subs if s["student_code"] == "1002")
    assert sub_1002["student_name"] == "Tran Thi Binh"
    assert sub_1002["grade_status"] == "draft"
    assert sub_1002["final_score"] == 5.5

    # Student 1003: Plagiarized submission, draft 6.0
    sub_1003 = next(s for s in sample_subs if s["student_code"] == "1003")
    assert sub_1003["student_name"] == "Le Van Cuong"
    assert sub_1003["grade_status"] == "draft"
    assert sub_1003["final_score"] == 6.0

    # 2. Verify token allows access to protected endpoints
    headers = auth_headers(seed_data["access_token"])
    me_res = client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["username"] == "demo_lecturer"

    # 3. Verify assignment metadata
    assign_url = f"/api/v1/courses/{course_id}/classes/{class_id}/assignments/{assignment_id}"
    assign_res = client.get(assign_url, headers=headers)
    assert assign_res.status_code == 200
    assign_data = assign_res.json()
    assert "Prime and Fibonacci" in assign_data["title"]
    assert "def is_prime" in assign_data["base_code"]

    # 4. Verify 4 test cases (2 public, 2 hidden)
    tc_res = client.get(f"{assign_url}/test-cases", headers=headers)
    assert tc_res.status_code == 200
    test_cases = tc_res.json()
    assert len(test_cases) == 4
    visibilities = {tc["name"]: tc["visibility"] for tc in test_cases}
    assert visibilities["test_prime_public"] == "public"
    assert visibilities["test_fib_public"] == "public"
    assert visibilities["test_prime_hidden"] == "hidden"
    assert visibilities["test_fib_hidden"] == "hidden"

    # 5. Verify rubric criteria sum to 100%
    rubric_res = client.get(f"{assign_url}/rubric", headers=headers)
    assert rubric_res.status_code == 200
    rubric_data = rubric_res.json()
    assert len(rubric_data["criteria"]) == 4
    total_weight = sum(c["weight_percentage"] for c in rubric_data["criteria"])
    assert total_weight == 100.0

    # 6. Verify evidence records for student 1002
    sub_1002_id = sub_1002["id"]
    ev_res = client.get(f"{assign_url}/submissions/{sub_1002_id}/evidence", headers=headers)
    assert ev_res.status_code == 200
    ev_list = ev_res.json()
    sources = {item["source"] for item in ev_list}
    assert "pytest" in sources
    assert "ruff" in sources
    assert "ast" in sources

    # 7. Verify similarity report flagged 1001 and 1003 at 85%
    sim_res = client.get(f"{assign_url}/similarity/reports", headers=headers)
    assert sim_res.status_code == 200
    reports = sim_res.json()
    assert len(reports) >= 1
    rep_id = reports[0]["id"]

    rep_detail = client.get(f"{assign_url}/similarity/reports/{rep_id}", headers=headers)
    assert rep_detail.status_code == 200
    comp_list = rep_detail.json()["comparisons"]
    flagged_comp = next(
        (c for c in comp_list if {c["submission_a_id"], c["submission_b_id"]} == {sub_1001["id"], sub_1003["id"]}),
        None,
    )
    assert flagged_comp is not None
    assert flagged_comp["similarity_percentage"] == 85.0
    assert flagged_comp["status"] == "flagged"

    # 8. Verify AI feedback draft for student 1002
    fb_res = client.get(f"{assign_url}/submissions/{sub_1002_id}/feedback", headers=headers)
    assert fb_res.status_code == 200
    fb_data = fb_res.json()
    assert fb_data["status"] == "draft"
    assert "detailed_feedback" in fb_data
    assert len(fb_data["detailed_feedback"]["citations"]) > 0


def test_demo_seed_idempotency(client: TestClient) -> None:
    """Test calling seed multiple times does not duplicate records or cause errors."""
    seed1 = client.post("/api/v1/demo/seed?reset=false").json()
    seed2 = client.post("/api/v1/demo/seed?reset=false").json()

    assert seed1["course_id"] == seed2["course_id"]
    assert seed1["class_id"] == seed2["class_id"]
    assert seed1["assignment_id"] == seed2["assignment_id"]
    assert len(seed2["sample_submissions"]) == 3


def test_demo_reset_endpoint(client: TestClient) -> None:
    """Test POST /api/v1/demo/reset cleanly resets environment back to baseline."""
    # Seed initially
    init_res = client.post("/api/v1/demo/seed")
    assert init_res.status_code == 200
    token = init_res.json()["access_token"]
    c_id = init_res.json()["course_id"]
    cl_id = init_res.json()["class_id"]
    a_id = init_res.json()["assignment_id"]
    sub_1002_id = init_res.json()["sample_submissions"][1]["id"]

    # Modify Student 1002 grade
    headers = auth_headers(token)
    client.put(
        f"/api/v1/courses/{c_id}/classes/{cl_id}/assignments/{a_id}/submissions/{sub_1002_id}/grade",
        headers=headers,
        json={"final_total_score": 9.5, "status": "confirmed", "feedback_summary": "Manual override"},
    )

    # Call reset
    reset_res = client.post("/api/v1/demo/reset")
    assert reset_res.status_code == 200
    reset_data = reset_res.json()
    assert reset_data["status"] == "success"
    assert "reset to baseline" in reset_data["message"]

    # Check that seed returns pristine baseline again
    new_seed = client.post("/api/v1/demo/seed").json()
    sub_1002_fresh = next(s for s in new_seed["sample_submissions"] if s["student_code"] == "1002")
    assert sub_1002_fresh["grade_status"] == "draft"
    assert sub_1002_fresh["final_score"] == 5.5


def test_demo_sample_zip_endpoint(client: TestClient) -> None:
    """Test GET /api/v1/demo/sample-zip returns a valid zip containing 3 student submissions."""
    zip_res = client.get("/api/v1/demo/sample-zip")
    assert zip_res.status_code == 200
    assert "application/zip" in zip_res.headers.get("content-type", "")
    assert "demo_submissions.zip" in zip_res.headers.get("content-disposition", "")

    # Unpack zip in memory
    zf = zipfile.ZipFile(io.BytesIO(zip_res.content))
    file_list = zf.namelist()
    assert len(file_list) == 3

    assert "Nguyen Van An_1001_assignsubmission_file_main.py" in file_list
    assert "Tran Thi Binh_1002_assignsubmission_file_main.py" in file_list
    assert "Le Van Cuong_1003_assignsubmission_file_main.py" in file_list

    # Verify content
    code_1001 = zf.read("Nguyen Van An_1001_assignsubmission_file_main.py").decode("utf-8")
    assert "def is_prime" in code_1001
    assert "def fibonacci" in code_1001


def test_demo_reset_with_enforced_foreign_keys() -> None:
    """Verify POST /api/v1/demo/reset succeeds with zero IntegrityError and zero orphaned rows when SQLite foreign keys are enforced."""
    fk_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(fk_engine, "connect")
    def set_fk_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys = ON")
        cursor.close()

    Base.metadata.create_all(bind=fk_engine)
    FKTestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=fk_engine)

    def override_get_db():
        session = FKTestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db

    try:
        with TestClient(app) as test_client:
            # 1. Verify foreign key enforcement is active in SQLite connection
            with FKTestingSessionLocal() as session:
                fk_status = session.execute(text("PRAGMA foreign_keys")).scalar()
                assert fk_status == 1, "SQLite PRAGMA foreign_keys must be active (1)"

            # 2. Initial seed
            seed_res = test_client.post("/api/v1/demo/seed")
            assert seed_res.status_code == 200, f"Seed failed: {seed_res.text}"
            seed_data = seed_res.json()
            assert len(seed_data["sample_submissions"]) == 3

            # 3. Call reset endpoint with foreign key enforcement active
            reset_res = test_client.post("/api/v1/demo/reset")
            assert reset_res.status_code == 200, f"Reset raised error under enforced FK: {reset_res.text}"
            reset_data = reset_res.json()
            assert reset_data["status"] == "success"
            assert "reset to baseline" in reset_data["message"]

            # 4. Check that all child and parent tables have exact baseline row counts (no row accumulation)
            with FKTestingSessionLocal() as session:
                assert session.scalar(select(func.count(Course.id))) == 1
                assert session.scalar(select(func.count(Cohort.id))) == 1
                assert session.scalar(select(func.count(Assignment.id))) == 1
                assert session.scalar(select(func.count(TestCase.id))) == 4
                assert session.scalar(select(func.count(Rubric.id))) == 1
                assert session.scalar(select(func.count(RubricCriterion.id))) == 4
                assert session.scalar(select(func.count(Submission.id))) == 3
                assert session.scalar(select(func.count(GradingJob.id))) == 3
                assert session.scalar(select(func.count(TestResult.id))) == 12
                assert session.scalar(select(func.count(SubmissionGrade.id))) == 3
                assert session.scalar(select(func.count(CriterionScore.id))) == 12
                assert session.scalar(select(func.count(SimilarityReport.id))) == 1
                assert session.scalar(select(func.count(SimilarityComparison.id))) == 3
                assert session.scalar(select(func.count(SubmissionEvidence.id))) == 19

                # 5. Referential integrity validation: verify zero orphaned rows in child tables
                orphaned_submissions = session.scalars(
                    select(Submission.id).where(
                        ~Submission.assignment_id.in_(select(Assignment.id))
                    )
                ).all()
                assert len(orphaned_submissions) == 0, f"Orphaned submissions found: {orphaned_submissions}"

                orphaned_test_results = session.scalars(
                    select(TestResult.id).where(
                        ~TestResult.grading_job_id.in_(select(GradingJob.id))
                        | ~TestResult.test_case_id.in_(select(TestCase.id))
                    )
                ).all()
                assert len(orphaned_test_results) == 0, f"Orphaned test results found: {orphaned_test_results}"

                orphaned_grading_jobs = session.scalars(
                    select(GradingJob.id).where(
                        ~GradingJob.submission_id.in_(select(Submission.id))
                    )
                ).all()
                assert len(orphaned_grading_jobs) == 0, f"Orphaned grading jobs found: {orphaned_grading_jobs}"

                orphaned_submission_grades = session.scalars(
                    select(SubmissionGrade.id).where(
                        ~SubmissionGrade.submission_id.in_(select(Submission.id))
                        | ~SubmissionGrade.rubric_id.in_(select(Rubric.id))
                    )
                ).all()
                assert len(orphaned_submission_grades) == 0, f"Orphaned submission grades found: {orphaned_submission_grades}"

                orphaned_criterion_scores = session.scalars(
                    select(CriterionScore.id).where(
                        ~CriterionScore.submission_grade_id.in_(select(SubmissionGrade.id))
                        | ~CriterionScore.criterion_id.in_(select(RubricCriterion.id))
                    )
                ).all()
                assert len(orphaned_criterion_scores) == 0, f"Orphaned criterion scores found: {orphaned_criterion_scores}"

                orphaned_similarity_comps = session.scalars(
                    select(SimilarityComparison.id).where(
                        ~SimilarityComparison.report_id.in_(select(SimilarityReport.id))
                    )
                ).all()
                assert len(orphaned_similarity_comps) == 0, f"Orphaned similarity comparisons found: {orphaned_similarity_comps}"
    finally:
        app.dependency_overrides.clear()
        Base.metadata.drop_all(bind=fk_engine)
        fk_engine.dispose()


def test_demo_seed_concurrency() -> None:
    """Verify concurrent requests to POST /api/v1/demo/seed return 200 without race conditions or 500 errors."""
    def override_get_db():
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db

    try:
        with TestClient(app) as test_client:
            def request_seed(worker_id: int) -> tuple[int, dict]:
                resp = test_client.post("/api/v1/demo/seed?reset=false")
                return resp.status_code, resp.json()

            # Execute 5 concurrent seed requests simultaneously
            with ThreadPoolExecutor(max_workers=5) as pool:
                results = list(pool.map(request_seed, range(5)))

            # Verify all 5 concurrent requests succeeded with HTTP 200
            for status_code, body in results:
                assert status_code == 200, f"Concurrent seed returned non-200: {status_code}, body: {body}"
                assert "access_token" in body
                assert body["user"]["username"] == "demo_lecturer"
                assert len(body["sample_submissions"]) == 3

            # Verify all requests resolved to the identical singleton demo entities
            course_ids = {body["course_id"] for _, body in results}
            assignment_ids = {body["assignment_id"] for _, body in results}
            assert len(course_ids) == 1, f"Multiple courses created under concurrency: {course_ids}"
            assert len(assignment_ids) == 1, f"Multiple assignments created under concurrency: {assignment_ids}"

            # Verify database has zero duplicate entities
            with TestingSessionLocal() as session:
                lecturer_count = session.scalar(
                    select(func.count(User.id)).where(User.username == "demo_lecturer")
                )
                assert lecturer_count == 1, f"Duplicate demo lecturers created: {lecturer_count}"

                course_count = session.scalar(
                    select(func.count(Course.id)).where(Course.code == "CS102-DEMO")
                )
                assert course_count == 1, f"Duplicate demo courses created: {course_count}"

                submission_count = session.scalar(select(func.count(Submission.id)))
                assert submission_count == 3, f"Unexpected submission count under concurrency: {submission_count}"
    finally:
        app.dependency_overrides.clear()
