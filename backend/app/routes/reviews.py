import csv
import io
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_lecturer
from app.models import Assignment, Lecturer, LecturerReview, Submission, SubmissionStatus
from app.schemas import LecturerReviewCreate, LecturerReviewResponse

router = APIRouter(tags=["Lecturer Review & Final Decisions"])

@router.post("/submissions/{submission_id}/review", response_model=LecturerReviewResponse)
def submit_lecturer_review(
    submission_id: uuid.UUID,
    req: LecturerReviewCreate,
    db: Session = Depends(get_db),
    lecturer: Lecturer = Depends(get_current_lecturer),
):
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission or submission.assignment.course.lecturer_id != lecturer.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")

    review = db.query(LecturerReview).filter(LecturerReview.submission_id == submission_id).first()
    if not review:
        review = LecturerReview(
            submission_id=submission_id,
            reviewer_id=lecturer.id,
            automated_grade=req.final_grade,
            final_grade=req.final_grade,
            grade_adjustments=req.grade_adjustments,
            feedback_override=req.feedback_override,
            status=req.status,
            internal_notes=req.internal_notes,
        )
        db.add(review)
    else:
        review.reviewer_id = lecturer.id
        review.final_grade = req.final_grade
        if req.grade_adjustments:
            review.grade_adjustments = req.grade_adjustments
        review.feedback_override = req.feedback_override
        review.status = req.status
        review.internal_notes = req.internal_notes
        review.reviewed_at = datetime.now(timezone.utc)

    submission.status = SubmissionStatus.APPROVED if req.status == "APPROVED" else SubmissionStatus.FLAGGED
    db.commit()
    db.refresh(review)

    return LecturerReviewResponse.model_validate(review)


@router.get("/assignments/{assignment_id}/export")
def export_assignment_grades_csv(
    assignment_id: uuid.UUID,
    db: Session = Depends(get_db),
    lecturer: Lecturer = Depends(get_current_lecturer),
):
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment or assignment.course.lecturer_id != lecturer.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")

    submissions = db.query(Submission).filter(Submission.assignment_id == assignment_id).order_by(Submission.student_identifier.asc()).all()

    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow([
        "Student ID",
        "Student Name",
        "Submission Status",
        "Automated Grade",
        "Final Grade",
        "Review Status",
        "Tests Passed",
        "Tests Total",
        "Max Cyclomatic Complexity",
        "Ruff Issues Count",
        "AI Risk Tier",
        "Reviewer Feedback",
        "Internal Notes",
        "Reviewed At",
    ])

    for s in submissions:
        rev = s.lecturer_review
        exec_res = s.execution_result
        qm = s.quality_metric
        ai_sig = s.ai_detection_signal

        writer.writerow([
            s.student_identifier,
            s.student_name,
            s.status.value,
            str(rev.automated_grade) if rev else "",
            str(rev.final_grade) if rev else "",
            rev.status.value if rev else "",
            exec_res.passed_count if exec_res else 0,
            exec_res.total_count if exec_res else 0,
            qm.cyclomatic_complexity_max if qm else 0,
            len(qm.ruff_violations) if qm else 0,
            ai_sig.confidence_tier.value if ai_sig else "",
            rev.feedback_override or (s.ai_feedback_draft.summary if s.ai_feedback_draft else ""),
            rev.internal_notes or "",
            rev.reviewed_at.isoformat() if rev and rev.reviewed_at else "",
        ])

    csv_content = output.getvalue()
    filename = f"grades_{assignment.course.code}_{assignment.title.replace(' ', '_')}.csv"

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
