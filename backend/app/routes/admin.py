from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select, text
from sqlalchemy.orm import Session, joinedload

from app.auth import get_current_user, get_password_hash
from app.config import get_settings
from app.database import get_db
from app.deletion import purge_class, purge_course
from app.models import (
    Assignment,
    ClassMembership,
    Cohort,
    Course,
    GradingJob,
    GradingJobStatus,
    Submission,
    SubmissionGrade,
    User,
    UserRole,
)
from app.redis_client import bump_cache_version, notify_grading_worker
from app.schemas import (
    AdminClassItem,
    AdminCourseItem,
    AdminFailedJobItem,
    AdminOverviewResponse,
    AdminSystemHealth,
    AdminUserCreate,
    AdminUserUpdate,
    UserResponse,
)
from app.submission_storage import SubmissionStorage

router = APIRouter(prefix="/admin", tags=["admin"])


def require_admin(current_user: Annotated[User, Depends(get_current_user)]) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


@router.get("/overview", response_model=AdminOverviewResponse)
def get_admin_overview(
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> AdminOverviewResponse:
    role_counts = {r.value: 0 for r in UserRole}
    for role_val, cnt in db.execute(select(User.role, func.count(User.id)).group_by(User.role)):
        key = role_val.value if isinstance(role_val, UserRole) else str(role_val)
        role_counts[key] = int(cnt)

    job_counts = {s.value: 0 for s in GradingJobStatus}
    for status_val, cnt in db.execute(
        select(GradingJob.status, func.count(GradingJob.id)).group_by(GradingJob.status)
    ):
        key = status_val.value if isinstance(status_val, GradingJobStatus) else str(status_val)
        job_counts[key] = int(cnt)

    failed_jobs = db.scalars(
        select(GradingJob)
        .where(GradingJob.status == GradingJobStatus.FAILED)
        .order_by(GradingJob.created_at.desc())
        .limit(10)
    ).all()

    return AdminOverviewResponse(
        total_users=sum(role_counts.values()),
        users_by_role=role_counts,
        total_courses=int(db.scalar(select(func.count(Course.id))) or 0),
        total_classes=int(db.scalar(select(func.count(Cohort.id))) or 0),
        total_assignments=int(db.scalar(select(func.count(Assignment.id))) or 0),
        total_submissions=int(db.scalar(select(func.count(Submission.id))) or 0),
        jobs_by_status=job_counts,
        recent_failed_jobs=[
            AdminFailedJobItem(
                id=j.id,
                submission_id=j.submission_id,
                error_message=j.failure_information,
                created_at=j.created_at,
            )
            for j in failed_jobs
        ],
    )


@router.get("/users", response_model=list[UserResponse])
def list_users(
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
    search: str | None = Query(default=None, max_length=128),
    role: UserRole | None = Query(default=None),
) -> list[User]:
    stmt = select(User).order_by(User.created_at.desc())
    if role is not None:
        stmt = stmt.where(User.role == role)
    if search:
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                User.username.ilike(pattern),
                User.email.ilike(pattern),
                User.full_name.ilike(pattern),
            )
        )
    return list(db.scalars(stmt).all())


@router.patch("/users/{user_id}", response_model=UserResponse)
def update_user_admin(
    user_id: int,
    payload: AdminUserUpdate,
    admin_user: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    target = db.scalar(select(User).where(User.id == user_id))
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if target.id == admin_user.id:
        if payload.is_active is False:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot deactivate your own admin account",
            )
        if payload.role is not None and payload.role != UserRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot remove your own admin role",
            )

    if payload.role is not None:
        target.role = payload.role
    if payload.is_active is not None:
        target.is_active = payload.is_active
    if payload.is_email_verified is not None:
        target.is_email_verified = payload.is_email_verified

    db.commit()
    db.refresh(target)
    return target


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user_admin(
    payload: AdminUserCreate,
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    existing = db.scalar(
        select(User).where(
            or_(User.email == payload.email.lower(), User.username == payload.username.strip())
        )
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email or username is already registered",
        )

    user = User(
        username=payload.username.strip(),
        email=payload.email.lower(),
        full_name=payload.full_name.strip(),
        hashed_password=get_password_hash(payload.password),
        role=payload.role,
        is_active=payload.is_active,
        is_email_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user_admin(
    user_id: int,
    admin_user: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
    force: bool = Query(default=False),
) -> None:
    if user_id == admin_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own admin account",
        )

    target = db.scalar(select(User).where(User.id == user_id))
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    owned_courses = list(db.scalars(select(Course).where(Course.instructor_id == user_id)).all())
    if owned_courses and not force:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"User owns {len(owned_courses)} course(s). Confirm force delete to purge those courses and their data.",
        )

    storage = SubmissionStorage()
    for course in owned_courses:
        purge_course(db, course, storage)

    memberships = list(db.scalars(select(ClassMembership).where(ClassMembership.user_id == user_id)).all())
    for mem in memberships:
        db.delete(mem)

    student_subs = list(db.scalars(select(Submission).where(Submission.student_id == user_id)).all())
    for sub in student_subs:
        sub.student_id = None

    confirmed_grades = list(
        db.scalars(select(SubmissionGrade).where(SubmissionGrade.confirmed_by_id == user_id)).all()
    )
    for grade in confirmed_grades:
        grade.confirmed_by_id = None

    db.flush()
    db.delete(target)
    db.commit()


@router.post("/jobs/{job_id}/retry")
def retry_failed_job(
    job_id: int,
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, str | int]:
    job = db.scalar(select(GradingJob).where(GradingJob.id == job_id))
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grading job not found")

    job.status = GradingJobStatus.QUEUED
    job.failure_type = None
    job.failure_information = None
    job.runner_output = None
    job.started_at = None
    job.completed_at = None
    db.commit()
    notify_grading_worker(1)
    return {"id": job.id, "status": job.status.value}


@router.get("/courses", response_model=list[AdminCourseItem])
def list_all_courses_admin(
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> list[AdminCourseItem]:
    courses = list(
        db.scalars(
            select(Course).options(joinedload(Course.instructor), joinedload(Course.classes)).order_by(Course.created_at.desc())
        ).unique().all()
    )
    items: list[AdminCourseItem] = []
    for c in courses:
        class_ids = [cl.id for cl in c.classes]
        sub_count = 0
        if class_ids:
            sub_count = int(
                db.scalar(
                    select(func.count(Submission.id))
                    .join(Assignment, Submission.assignment_id == Assignment.id)
                    .where(Assignment.class_id.in_(class_ids))
                )
                or 0
            )
        items.append(
            AdminCourseItem(
                id=c.id,
                code=c.code,
                name=c.name,
                instructor_id=c.instructor_id,
                instructor_name=c.instructor.full_name if c.instructor else "Unknown",
                instructor_email=c.instructor.email if c.instructor else "",
                class_count=len(c.classes),
                submission_count=sub_count,
                created_at=c.created_at,
            )
        )
    return items


@router.delete("/courses/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course_admin(
    course_id: int,
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    course = db.scalar(select(Course).where(Course.id == course_id))
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    purge_course(db, course)
    db.commit()
    bump_cache_version("courses")


@router.get("/classes", response_model=list[AdminClassItem])
def list_all_classes_admin(
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> list[AdminClassItem]:
    cohorts = list(
        db.scalars(
            select(Cohort).options(joinedload(Cohort.course), joinedload(Cohort.assignments)).order_by(Cohort.created_at.desc())
        ).unique().all()
    )
    return [
        AdminClassItem(
            id=cl.id,
            course_id=cl.course_id,
            course_code=cl.course.code if cl.course else "",
            code=cl.code,
            name=cl.name,
            semester=cl.semester,
            year=cl.year,
            assignment_count=len(cl.assignments),
            created_at=cl.created_at,
        )
        for cl in cohorts
    ]


@router.delete("/classes/{class_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_class_admin(
    class_id: int,
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> None:
    cohort = db.scalar(select(Cohort).where(Cohort.id == class_id))
    if not cohort:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")
    purge_class(db, cohort)
    db.commit()


@router.get("/health", response_model=AdminSystemHealth)
def get_system_health_admin(
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> AdminSystemHealth:
    db_ok = True
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        db_ok = False

    storage_ok = True
    try:
        store = SubmissionStorage()
        storage_ok = store.root.exists() or store.root.parent.exists()
    except Exception:
        storage_ok = False

    settings = get_settings()
    queued = int(db.scalar(select(func.count(GradingJob.id)).where(GradingJob.status == GradingJobStatus.QUEUED)) or 0)
    running = int(db.scalar(select(func.count(GradingJob.id)).where(GradingJob.status == GradingJobStatus.RUNNING)) or 0)
    failed = int(db.scalar(select(func.count(GradingJob.id)).where(GradingJob.status == GradingJobStatus.FAILED)) or 0)

    return AdminSystemHealth(
        database_ok=db_ok,
        storage_ok=storage_ok,
        worker_mode=getattr(settings, "grading_runner_mode", "subprocess"),
        queued_jobs=queued,
        running_jobs=running,
        failed_jobs=failed,
        checked_at=datetime.now(timezone.utc),
    )
