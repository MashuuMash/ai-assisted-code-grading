import uuid
from decimal import Decimal
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_lecturer
from app.models import Assignment, Course, CriterionType, Lecturer, Rubric, RubricCriterion, TestCase
from app.schemas import (
    AssignmentCreate,
    AssignmentResponse,
    RubricCriterionCreate,
    RubricResponse,
    RubricUpdate,
    TestCaseResponse,
)

router = APIRouter(tags=["Assignments"])

@router.get("/courses/{course_id}/assignments", response_model=List[AssignmentResponse])
def list_assignments_for_course(
    course_id: uuid.UUID,
    db: Session = Depends(get_db),
    lecturer: Lecturer = Depends(get_current_lecturer),
):
    course = db.query(Course).filter(Course.id == course_id, Course.lecturer_id == lecturer.id).first()
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")

    assignments = db.query(Assignment).filter(Assignment.course_id == course_id).order_by(Assignment.created_at.desc()).all()
    results = []
    for a in assignments:
        resp = AssignmentResponse.model_validate(a)
        resp.test_cases_count = len(a.test_cases)
        resp.submissions_count = len(a.submissions)
        results.append(resp)
    return results

@router.post("/courses/{course_id}/assignments", response_model=AssignmentResponse, status_code=status.HTTP_201_CREATED)
def create_assignment(
    course_id: uuid.UUID,
    req: AssignmentCreate,
    db: Session = Depends(get_db),
    lecturer: Lecturer = Depends(get_current_lecturer),
):
    course = db.query(Course).filter(Course.id == course_id, Course.lecturer_id == lecturer.id).first()
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")

    assignment = Assignment(
        course_id=course_id,
        title=req.title,
        description=req.description,
        deadline=req.deadline,
        max_score=req.max_score,
        timeout_sec=req.timeout_sec,
        memory_limit_mb=req.memory_limit_mb,
    )
    db.add(assignment)
    db.flush()

    # Add test cases
    for tc in req.test_cases:
        test_case = TestCase(
            assignment_id=assignment.id,
            name=tc.name,
            description=tc.description,
            input_data=tc.input_data,
            expected_output=tc.expected_output,
            is_hidden=tc.is_hidden,
            weight=tc.weight,
            timeout_ms=tc.timeout_ms,
        )
        db.add(test_case)

    # Add standard Rubric
    rubric = Rubric(
        assignment_id=assignment.id,
        title=f"Grading Rubric for {assignment.title}",
    )
    db.add(rubric)
    db.flush()

    if req.rubric_criteria:
        for idx, crit in enumerate(req.rubric_criteria):
            rc = RubricCriterion(
                rubric_id=rubric.id,
                title=crit.title,
                criterion_type=crit.criterion_type,
                weight=crit.weight,
                max_points=crit.max_points,
                evaluation_config=crit.evaluation_config,
                order_index=idx,
            )
            db.add(rc)
    else:
        # Default criteria
        db.add(RubricCriterion(
            rubric_id=rubric.id,
            title="Functional Test Correctness",
            criterion_type=CriterionType.FUNCTIONAL_TEST,
            weight=Decimal("0.6000"),
            max_points=req.max_score * Decimal("0.60"),
            evaluation_config={},
            order_index=0,
        ))
        db.add(RubricCriterion(
            rubric_id=rubric.id,
            title="Code Quality & Style (Ruff)",
            criterion_type=CriterionType.CODE_QUALITY,
            weight=Decimal("0.2000"),
            max_points=req.max_score * Decimal("0.20"),
            evaluation_config={"deduction_per_ruff_issue": "0.20"},
            order_index=1,
        ))
        db.add(RubricCriterion(
            rubric_id=rubric.id,
            title="Structural & AST Metrics",
            criterion_type=CriterionType.AST_STRUCTURE,
            weight=Decimal("0.2000"),
            max_points=req.max_score * Decimal("0.20"),
            evaluation_config={"max_cyclomatic_complexity": 10, "max_nesting_depth": 4},
            order_index=2,
        ))

    db.commit()
    db.refresh(assignment)

    resp = AssignmentResponse.model_validate(assignment)
    resp.test_cases_count = len(assignment.test_cases)
    resp.submissions_count = 0
    return resp

@router.get("/assignments/{assignment_id}", response_model=AssignmentResponse)
def get_assignment(
    assignment_id: uuid.UUID,
    db: Session = Depends(get_db),
    lecturer: Lecturer = Depends(get_current_lecturer),
):
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment or assignment.course.lecturer_id != lecturer.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")
    resp = AssignmentResponse.model_validate(assignment)
    resp.test_cases_count = len(assignment.test_cases)
    resp.submissions_count = len(assignment.submissions)
    return resp

@router.get("/assignments/{assignment_id}/test-cases", response_model=List[TestCaseResponse])
def get_test_cases(
    assignment_id: uuid.UUID,
    db: Session = Depends(get_db),
    lecturer: Lecturer = Depends(get_current_lecturer),
):
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment or assignment.course.lecturer_id != lecturer.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")
    return [TestCaseResponse.model_validate(tc) for tc in assignment.test_cases]

@router.get("/assignments/{assignment_id}/rubric", response_model=RubricResponse)
def get_rubric(
    assignment_id: uuid.UUID,
    db: Session = Depends(get_db),
    lecturer: Lecturer = Depends(get_current_lecturer),
):
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment or assignment.course.lecturer_id != lecturer.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")
    if not assignment.rubric:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rubric not configured")
    return RubricResponse.model_validate(assignment.rubric)

@router.put("/assignments/{assignment_id}/rubric", response_model=RubricResponse)
def update_rubric(
    assignment_id: uuid.UUID,
    req: RubricUpdate,
    db: Session = Depends(get_db),
    lecturer: Lecturer = Depends(get_current_lecturer),
):
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment or assignment.course.lecturer_id != lecturer.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")

    rubric = assignment.rubric
    if not rubric:
        rubric = Rubric(assignment_id=assignment_id, title=req.title or "Grading Rubric")
        db.add(rubric)
        db.flush()
    elif req.title:
        rubric.title = req.title

    # Remove old criteria and insert updated criteria
    db.query(RubricCriterion).filter(RubricCriterion.rubric_id == rubric.id).delete()
    for idx, crit in enumerate(req.criteria):
        rc = RubricCriterion(
            rubric_id=rubric.id,
            title=crit.title,
            criterion_type=crit.criterion_type,
            weight=crit.weight,
            max_points=crit.max_points,
            evaluation_config=crit.evaluation_config,
            order_index=idx,
        )
        db.add(rc)

    db.commit()
    db.refresh(rubric)
    return RubricResponse.model_validate(rubric)
