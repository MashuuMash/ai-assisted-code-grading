from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import (
    Assignment,
    Cohort,
    Course,
    EvaluationType,
    EvidenceCategory,
    GradeStatus,
    GradingJob,
    GradingJobStatus,
    Rubric,
    RubricCriterion,
    Submission,
    SubmissionGrade,
    TestCase,
    TestOutcome,
    TestResult,
    TestVisibility,
    User,
)
from tests.conftest import auth_headers


def test_admin_overview_and_user_management(
    client: TestClient,
    admin_user: User,
    admin_token: str,
    lecturer_user: User,
    lecturer_token: str,
    student_user: User,
) -> None:
    # 1. Lecturer cannot access admin endpoints
    res_forbidden = client.get("/api/v1/admin/overview", headers=auth_headers(lecturer_token))
    assert res_forbidden.status_code == 403

    res_users_forbidden = client.get("/api/v1/admin/users", headers=auth_headers(lecturer_token))
    assert res_users_forbidden.status_code == 403

    # 2. Admin can retrieve system overview
    res_overview = client.get("/api/v1/admin/overview", headers=auth_headers(admin_token))
    assert res_overview.status_code == 200
    overview = res_overview.json()
    assert overview["total_users"] >= 3
    assert overview["users_by_role"]["admin"] >= 1
    assert overview["users_by_role"]["lecturer"] >= 1
    assert overview["users_by_role"]["student"] >= 1

    # 3. Admin can list and filter users
    res_list = client.get("/api/v1/admin/users?search=student", headers=auth_headers(admin_token))
    assert res_list.status_code == 200
    usernames = [u["username"] for u in res_list.json()]
    assert student_user.username in usernames

    # 4. Admin cannot deactivate or demote self
    res_self_deactivate = client.patch(
        f"/api/v1/admin/users/{admin_user.id}",
        headers=auth_headers(admin_token),
        json={"is_active": False},
    )
    assert res_self_deactivate.status_code == 400

    res_self_demote = client.patch(
        f"/api/v1/admin/users/{admin_user.id}",
        headers=auth_headers(admin_token),
        json={"role": "lecturer"},
    )
    assert res_self_demote.status_code == 400

    # 5. Admin can update another user's role, active status, and email verification
    res_update = client.patch(
        f"/api/v1/admin/users/{student_user.id}",
        headers=auth_headers(admin_token),
        json={"role": "lecturer", "is_active": False, "is_email_verified": True},
    )
    assert res_update.status_code == 200
    updated = res_update.json()
    assert updated["role"] == "lecturer"
    assert updated["is_active"] is False
    assert updated["is_email_verified"] is True


def test_delete_assignment_class_and_course_with_graded_children(
    client: TestClient,
    db: Session,
    lecturer_user: User,
    lecturer_token: str,
) -> None:
    course = Course(code="DEL101", name="Delete Course", instructor_id=lecturer_user.id)
    db.add(course)
    db.flush()

    cohort = Cohort(code="DEL-C1", name="Delete Cohort", semester="Fall", year=2026, course_id=course.id)
    db.add(cohort)
    db.flush()

    assignment = Assignment(class_id=cohort.id, title="Delete Assignment")
    db.add(assignment)
    db.flush()

    tc = TestCase(
        assignment_id=assignment.id,
        name="test_basic",
        content="def test_basic(): assert True",
        visibility=TestVisibility.PUBLIC,
    )
    db.add(tc)
    db.flush()

    rubric = Rubric(assignment_id=assignment.id, title="Rubric", max_score=10.0)
    db.add(rubric)
    db.flush()

    crit = RubricCriterion(
        rubric_id=rubric.id,
        title="Correctness",
        category=EvidenceCategory.CORRECTNESS,
        evaluation_type=EvaluationType.AUTOMATED_TEST,
        weight_percentage=100.0,
        max_points=10.0,
        order_index=0,
    )
    db.add(crit)
    db.flush()

    sub = Submission(
        assignment_id=assignment.id,
        student_identifier="S001",
        original_filename="sol.py",
        storage_key=("deadbeef" * 4) + ".py",
        size_bytes=12,
        sha256="a" * 64,
    )
    db.add(sub)
    db.flush()

    job = GradingJob(submission_id=sub.id, status=GradingJobStatus.COMPLETED)
    db.add(job)
    db.flush()

    tr = TestResult(grading_job_id=job.id, test_case_id=tc.id, test_name="test_basic", outcome=TestOutcome.PASSED)
    grade = SubmissionGrade(
        submission_id=sub.id,
        rubric_id=rubric.id,
        suggested_total_score=10.0,
        final_total_score=10.0,
        status=GradeStatus.CONFIRMED,
    )
    db.add_all([tr, grade])
    db.commit()

    # 1. Delete assignment (which has TestResult + SubmissionGrade referencing TestCase & Rubric)
    res_del_asg = client.delete(
        f"/api/v1/courses/{course.id}/classes/{cohort.id}/assignments/{assignment.id}",
        headers=auth_headers(lecturer_token),
    )
    assert res_del_asg.status_code == 204

    # 2. Delete class
    res_del_cls = client.delete(
        f"/api/v1/courses/{course.id}/classes/{cohort.id}",
        headers=auth_headers(lecturer_token),
    )
    assert res_del_cls.status_code == 204

    # 3. Delete course
    res_del_crs = client.delete(
        f"/api/v1/courses/{course.id}",
        headers=auth_headers(lecturer_token),
    )
    assert res_del_crs.status_code == 204


def test_admin_create_delete_user_governance_jobs_and_health(
    client: TestClient,
    db: Session,
    admin_user: User,
    admin_token: str,
    lecturer_user: User,
) -> None:
    # 1. Create a new user via Admin API
    res_create = client.post(
        "/api/v1/admin/users",
        headers=auth_headers(admin_token),
        json={
            "username": "new_lecturer_99",
            "email": "new_lecturer_99@school.edu",
            "full_name": "New Lecturer 99",
            "password": "password123",
            "role": "lecturer",
        },
    )
    assert res_create.status_code == 201
    new_user = res_create.json()
    assert new_user["username"] == "new_lecturer_99"
    assert new_user["role"] == "lecturer"

    # Duplicate email returns 409
    res_dup = client.post(
        "/api/v1/admin/users",
        headers=auth_headers(admin_token),
        json={
            "username": "other_name",
            "email": "new_lecturer_99@school.edu",
            "full_name": "Dup",
            "password": "password123",
            "role": "student",
        },
    )
    assert res_dup.status_code == 409

    # 2. Cannot delete self
    res_self_del = client.delete(
        f"/api/v1/admin/users/{admin_user.id}",
        headers=auth_headers(admin_token),
    )
    assert res_self_del.status_code == 400

    # 3. Create course + class + assignment + failed job owned by new_lecturer_99
    course = Course(code="ADM-CS", name="Admin Gov Course", instructor_id=new_user["id"])
    db.add(course)
    db.flush()
    cohort = Cohort(code="GOV-1", name="Gov Class 1", semester="Fall", year=2026, course_id=course.id)
    db.add(cohort)
    db.flush()
    asg = Assignment(class_id=cohort.id, title="Gov HW1")
    db.add(asg)
    db.flush()
    sub = Submission(
        assignment_id=asg.id,
        student_identifier="523H0099",
        original_filename="sol.py",
        storage_key=("abcd1234" * 4) + ".py",
        size_bytes=10,
        sha256="b" * 64,
    )
    db.add(sub)
    db.flush()
    failed_job = GradingJob(
        submission_id=sub.id,
        status=GradingJobStatus.FAILED,
        failure_type="Timeout",
        failure_information="Execution exceeded 5s limit",
    )
    db.add(failed_job)
    db.commit()

    # Check overview includes the failed job without AttributeError
    res_ov_failed = client.get("/api/v1/admin/overview", headers=auth_headers(admin_token))
    assert res_ov_failed.status_code == 200
    assert any(j["id"] == failed_job.id and "5s limit" in (j["error_message"] or "") for j in res_ov_failed.json()["recent_failed_jobs"])

    # 4. Retry failed job resets to QUEUED
    res_retry = client.post(
        f"/api/v1/admin/jobs/{failed_job.id}/retry",
        headers=auth_headers(admin_token),
    )
    assert res_retry.status_code == 200
    assert res_retry.json()["status"] == "queued"

    # 5. List courses & classes, check health
    res_courses = client.get("/api/v1/admin/courses", headers=auth_headers(admin_token))
    assert res_courses.status_code == 200
    assert any(c["id"] == course.id for c in res_courses.json())

    res_classes = client.get("/api/v1/admin/classes", headers=auth_headers(admin_token))
    assert res_classes.status_code == 200
    assert any(cl["id"] == cohort.id for cl in res_classes.json())

    res_health = client.get("/api/v1/admin/health", headers=auth_headers(admin_token))
    assert res_health.status_code == 200
    assert res_health.json()["database_ok"] is True

    # 6. Deleting user with owned course requires force=true
    res_del_conflict = client.delete(
        f"/api/v1/admin/users/{new_user['id']}",
        headers=auth_headers(admin_token),
    )
    assert res_del_conflict.status_code == 409

    res_del_force = client.delete(
        f"/api/v1/admin/users/{new_user['id']}?force=true",
        headers=auth_headers(admin_token),
    )
    assert res_del_force.status_code == 204
    assert db.get(Course, course.id) is None
    assert db.get(User, new_user["id"]) is None
