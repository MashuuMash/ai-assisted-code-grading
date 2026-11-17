import io
import zipfile

import pytest

from app.batch_ingestion import ingest_batch_zip, parse_submission_metadata
from app.models import (
    Assignment,
    AssignmentStatus,
    Cohort,
    Course,
    GradingJob,
    GradingJobStatus,
    Submission,
    User,
    UserRole,
)
from app.submission_storage import SubmissionStorage


def test_parse_submission_metadata_patterns():
    # Moodle format
    moodle_path = "Nguyen Van A_123456_assignsubmission_file_main.py"
    meta = parse_submission_metadata(moodle_path)
    assert meta.student_identifier == "123456"
    assert meta.student_name == "Nguyen Van A"
    assert meta.clean_filename == "main.py"

    # Moodle folder format
    moodle_folder_path = "Tran Thi B_654321_assignsubmission_file/solution.py"
    meta_folder = parse_submission_metadata(moodle_folder_path)
    assert meta_folder.student_identifier == "654321"
    assert meta_folder.student_name == "Tran Thi B"
    assert meta_folder.clean_filename == "solution.py"

    # Google Classroom format
    gc_path = "Le Van C - final_project.py"
    meta_gc = parse_submission_metadata(gc_path)
    assert meta_gc.student_identifier == "Le Van C"
    assert meta_gc.clean_filename == "final_project.py"

    # Canvas format
    canvas_path = "pham_van_d_888888_999999_assignment1.py"
    meta_canvas = parse_submission_metadata(canvas_path)
    assert meta_canvas.student_identifier == "888888"
    assert meta_canvas.student_name == "Pham Van D"
    assert meta_canvas.clean_filename == "assignment1.py"

    # Simple ID format
    id_path = "SV2026001.py"
    meta_id = parse_submission_metadata(id_path)
    assert meta_id.student_identifier == "SV2026001"
    assert meta_id.clean_filename == "SV2026001.py"


def test_batch_ingestion_success(db):
    storage = SubmissionStorage()

    # Create lecturer, course, class, assignment
    lecturer = User(email="lecturer@school.edu", username="prof_batch", full_name="Prof Batch", hashed_password="x", role=UserRole.LECTURER)
    db.add(lecturer)
    db.flush()

    course = Course(code="CS101-BATCH", name="Batch Intro", instructor_id=lecturer.id)
    db.add(course)
    db.flush()

    cohort = Cohort(code="C1", name="Cohort 1", semester="Fall", year=2026, course_id=course.id)
    db.add(cohort)
    db.flush()

    assignment = Assignment(class_id=cohort.id, title="Batch Assignment", status=AssignmentStatus.PUBLISHED)
    db.add(assignment)
    db.flush()

    # Build an in-memory zip archive with 3 student submissions
    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("Nguyen Van A_111111_assignsubmission_file_main.py", "def solution(): return 42\n")
        zf.writestr("Tran Van B - task.py", "def solution(): return 100\n")
        zf.writestr("SV222222.py", "def solution(): return 200\n")
        # Non-python file that should be ignored
        zf.writestr("README.txt", "Please grade generously")

    zip_bytes = zip_buf.getvalue()

    resp = ingest_batch_zip(
        db=db,
        assignment_id=assignment.id,
        archive_bytes=zip_bytes,
        auto_queue=True,
        storage=storage,
    )

    assert resp.total_found == 3
    assert resp.imported_count == 3
    assert resp.failed_count == 0
    assert len(resp.submissions) == 3

    # Verify submissions persisted in DB
    subs = list(db.query(Submission).filter(Submission.assignment_id == assignment.id).all())
    assert len(subs) == 3
    sids = {s.student_identifier for s in subs}
    assert "111111" in sids
    assert "Tran Van B" in sids
    assert "SV222222" in sids

    # Verify grading jobs created with QUEUED status
    jobs = list(db.query(GradingJob).all())
    assert len(jobs) == 3
    assert all(j.status == GradingJobStatus.QUEUED for j in jobs)


def test_batch_ingestion_zip_slip_protection(db):
    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w") as zf:
        zf.writestr("../../evil.py", "print('malicious')\n")

    with pytest.raises(ValueError, match="Illegal file path in archive"):
        ingest_batch_zip(
            db=db,
            assignment_id=1,
            archive_bytes=zip_buf.getvalue(),
        )


def test_batch_ingestion_invalid_zip(db):
    with pytest.raises(ValueError, match="not a valid ZIP archive"):
        ingest_batch_zip(
            db=db,
            assignment_id=1,
            archive_bytes=b"not-a-zip-file-content",
        )


def test_batch_ingestion_duplicate_skip_and_update(db, tmp_path):
    from app.models import Assignment, AssignmentStatus, Cohort, Course, User, UserRole
    from app.submission_storage import SubmissionStorage

    lecturer = User(
        email="dup_lec@example.com",
        username="dup_lec",
        hashed_password="x",
        full_name="Dup Lecturer",
        role=UserRole.LECTURER,
    )
    db.add(lecturer)
    db.flush()

    course = Course(code="CS102-DUP", name="Dup Test", instructor_id=lecturer.id)
    db.add(course)
    db.flush()

    cohort = Cohort(code="C2", name="Class B", semester="Fall", year=2026, course_id=course.id)
    db.add(cohort)
    db.flush()

    assignment = Assignment(class_id=cohort.id, title="HW2", status=AssignmentStatus.PUBLISHED)
    db.add(assignment)
    db.commit()

    storage = SubmissionStorage()

    # First upload: 2 students
    zip1 = io.BytesIO()
    with zipfile.ZipFile(zip1, "w") as zf:
        zf.writestr("523H0001.py", "def add(a, b): return a + b\n")
        zf.writestr("523H0002.py", "def add(a, b): return a + b + 0\n")

    resp1 = ingest_batch_zip(
        db=db,
        assignment_id=assignment.id,
        archive_bytes=zip1.getvalue(),
        auto_queue=True,
        storage=storage,
    )
    assert resp1.imported_count == 2
    assert resp1.updated_count == 0
    assert resp1.skipped_count == 0

    # Second upload: 523H0001 unchanged (skipped), 523H0002 modified (updated), 523H0003 new (imported)
    zip2 = io.BytesIO()
    with zipfile.ZipFile(zip2, "w") as zf:
        zf.writestr("523H0001.py", "def add(a, b): return a + b\n")
        zf.writestr("523H0002.py", "def add(a, b):\n    return a + b\n")
        zf.writestr("523H0003.py", "def add(a, b): return sum([a, b])\n")

    resp2 = ingest_batch_zip(
        db=db,
        assignment_id=assignment.id,
        archive_bytes=zip2.getvalue(),
        auto_queue=True,
        storage=storage,
    )
    assert resp2.total_found == 3
    assert resp2.imported_count == 1
    assert resp2.updated_count == 1
    assert resp2.skipped_count == 1
    assert len(resp2.skipped) == 1
    assert "523H0001" in resp2.skipped[0]

    subs = list(db.query(Submission).filter(Submission.assignment_id == assignment.id).all())
    assert len(subs) == 3
    jobs = list(db.query(GradingJob).all())
    # 2 initial + 1 updated + 1 new = 4 jobs (skipped 523H0001 did NOT create a new job)
    assert len(jobs) == 4
