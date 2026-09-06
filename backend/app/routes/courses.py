import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_lecturer
from app.models import Course, Lecturer
from app.schemas import CourseCreate, CourseResponse

router = APIRouter(prefix="/courses", tags=["Courses"])

@router.get("", response_model=List[CourseResponse])
def list_courses(
    db: Session = Depends(get_db),
    lecturer: Lecturer = Depends(get_current_lecturer),
):
    courses = db.query(Course).filter(Course.lecturer_id == lecturer.id).order_by(Course.created_at.desc()).all()
    results = []
    for c in courses:
        resp = CourseResponse.model_validate(c)
        resp.assignment_count = len(c.assignments)
        results.append(resp)
    return results

@router.post("", response_model=CourseResponse, status_code=status.HTTP_201_CREATED)
def create_course(
    req: CourseCreate,
    db: Session = Depends(get_db),
    lecturer: Lecturer = Depends(get_current_lecturer),
):
    course = Course(
        lecturer_id=lecturer.id,
        code=req.code,
        name=req.name,
        semester=req.semester,
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    resp = CourseResponse.model_validate(course)
    resp.assignment_count = 0
    return resp

@router.get("/{course_id}", response_model=CourseResponse)
def get_course(
    course_id: uuid.UUID,
    db: Session = Depends(get_db),
    lecturer: Lecturer = Depends(get_current_lecturer),
):
    course = db.query(Course).filter(Course.id == course_id, Course.lecturer_id == lecturer.id).first()
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    resp = CourseResponse.model_validate(course)
    resp.assignment_count = len(course.assignments)
    return resp
