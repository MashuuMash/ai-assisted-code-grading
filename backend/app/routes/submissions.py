import os
import uuid
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session
from app.ai_integrity.advisor import analyze_ai_heuristics, generate_grounded_feedback
from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_lecturer
from app.execution.runner import run_code_in_sandbox
from app.grading.evaluator import evaluate_submission
from app.ingestion.sanitizer import compute_sha256, extract_safe_zip, parse_roster_csv
from app.models import (
    AIDetectionSignal,
    AIFeedbackDraft,
    Assignment,
    ExecutionResult,
    ExecutionStatus,
    Lecturer,
    LecturerReview,
    QualityMetric,
    ReviewStatus,
    Submission,
    SubmissionFile,
    SubmissionStatus,
)
from app.quality_ast.analyzer import analyze_ast, run_ruff_linter
from app.schemas import (
    BatchUploadSummary,
    SubmissionDetailResponse,
    SubmissionListItem,
)

router = APIRouter(tags=["Submissions"])

def process_single_submission(
    db: Session,
    submission: Submission,
    files_dict: dict[str, str],
    assignment: Assignment,
):
    """
    Executes end-to-end evaluation pipeline for a submission:
    1. Isolated sandbox test execution (pytest)
    2. Static code analysis (AST visitor + Ruff)
    3. AI integrity heuristics & grounded feedback draft
    4. Deterministic Rubric scoring
    """
    # 1. Sandbox execution
    exec_data = run_code_in_sandbox(
        student_files=files_dict,
        test_cases=assignment.test_cases,
        timeout_sec=assignment.timeout_sec,
        memory_limit_mb=assignment.memory_limit_mb,
    )
    
    exec_status = ExecutionStatus.SUCCESS if exec_data["status"] == "SUCCESS" else (
        ExecutionStatus.TIMEOUT if exec_data["status"] == "TIMEOUT" else ExecutionStatus.FAILED
    )
    
    exec_result = db.query(ExecutionResult).filter(ExecutionResult.submission_id == submission.id).first()
    if not exec_result:
        exec_result = ExecutionResult(submission_id=submission.id, status=exec_status)
        db.add(exec_result)
    
    exec_result.status = exec_status
    exec_result.passed_count = exec_data["passed_count"]
    exec_result.failed_count = exec_data["failed_count"]
    exec_result.total_count = exec_data["total_count"]
    exec_result.execution_time_ms = exec_data["execution_time_ms"]
    exec_result.test_details = exec_data["test_details"]
    db.flush()

    # 2. AST & Ruff analysis
    combined_code = "\n\n".join(files_dict.values())
    ast_res = analyze_ast(combined_code)
    ruff_issues = run_ruff_linter(files_dict)

    qm = db.query(QualityMetric).filter(QualityMetric.submission_id == submission.id).first()
    if not qm:
        qm = QualityMetric(submission_id=submission.id)
        db.add(qm)

    qm.cyclomatic_complexity_max = ast_res["cyclomatic_complexity_max"]
    qm.cyclomatic_complexity_avg = ast_res["cyclomatic_complexity_avg"]
    qm.max_nesting_depth = ast_res["max_nesting_depth"]
    qm.loc_total = ast_res["loc_total"]
    qm.function_count = ast_res["function_count"]
    qm.banned_imports_found = ast_res["banned_imports_found"]
    qm.ruff_violations = ruff_issues
    db.flush()

    # 3. AI integrity heuristics & Grounded feedback
    ai_heuristics = analyze_ai_heuristics(combined_code)
    ai_sig = db.query(AIDetectionSignal).filter(AIDetectionSignal.submission_id == submission.id).first()
    if not ai_sig:
        ai_sig = AIDetectionSignal(submission_id=submission.id, probability_score=ai_heuristics["probability_score"], confidence_tier=ai_heuristics["confidence_tier"])
        db.add(ai_sig)

    ai_sig.probability_score = ai_heuristics["probability_score"]
    ai_sig.confidence_tier = ai_heuristics["confidence_tier"]
    ai_sig.indicators = ai_heuristics["indicators"]
    ai_sig.disclaimer = ai_heuristics["disclaimer"]
    db.flush()

    feedback_data = generate_grounded_feedback(
        student_code=combined_code,
        assignment_title=assignment.title,
        execution_result=exec_result,
        quality_metric=qm,
    )
    ai_fb = db.query(AIFeedbackDraft).filter(AIFeedbackDraft.submission_id == submission.id).first()
    if not ai_fb:
        ai_fb = AIFeedbackDraft(submission_id=submission.id, summary="", model_identifier="")
        db.add(ai_fb)

    ai_fb.summary = feedback_data["summary"]
    ai_fb.strengths = feedback_data["strengths"]
    ai_fb.weaknesses = feedback_data["weaknesses"]
    ai_fb.remediation_steps = feedback_data["remediation_steps"]
    ai_fb.model_identifier = feedback_data["model_identifier"]
    db.flush()

    # 4. Rubric evaluation
    rubric_eval = evaluate_submission(
        rubric=assignment.rubric,
        execution_result=exec_result,
        quality_metric=qm,
        max_score=assignment.max_score,
    )

    review = db.query(LecturerReview).filter(LecturerReview.submission_id == submission.id).first()
    if not review:
        review = LecturerReview(
            submission_id=submission.id,
            automated_grade=rubric_eval["automated_grade"],
            final_grade=rubric_eval["automated_grade"],
            grade_adjustments=rubric_eval["breakdown"],
            status=ReviewStatus.APPROVED,
        )
        db.add(review)
    else:
        review.automated_grade = rubric_eval["automated_grade"]
        if review.status == ReviewStatus.APPROVED:
            review.final_grade = rubric_eval["automated_grade"]
            review.grade_adjustments = rubric_eval["breakdown"]

    submission.status = SubmissionStatus.REQUIRES_REVIEW
    db.commit()


@router.post("/assignments/{assignment_id}/submissions/upload-batch", response_model=BatchUploadSummary)
async def upload_batch_submissions(
    assignment_id: uuid.UUID,
    archive_file: UploadFile = File(...),
    roster_file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    lecturer: Lecturer = Depends(get_current_lecturer),
):
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment or assignment.course.lecturer_id != lecturer.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")

    zip_bytes = await archive_file.read()
    if len(zip_bytes) > settings.MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file exceeds 50MB limit")

    archive_sha = compute_sha256(zip_bytes)
    
    # Save archive to storage
    archive_dir = os.path.join(settings.STORAGE_DIR, str(assignment_id))
    os.makedirs(archive_dir, exist_ok=True)
    archive_path = os.path.join(archive_dir, f"{archive_sha[:16]}_{archive_file.filename}")
    with open(archive_path, "wb") as f:
        f.write(zip_bytes)

    # Parse roster CSV if provided
    roster = {}
    if roster_file:
        roster_content = (await roster_file.read()).decode("utf-8", errors="replace")
        roster = parse_roster_csv(roster_content)

    submissions_map = extract_safe_zip(zip_bytes)
    total_found = len(submissions_map)
    created_count = 0
    details = []

    for student_key, files in submissions_map.items():
        if not files:
            continue

        # Extract student identifier and name
        if "_" in student_key:
            parts = student_key.split("_", 1)
            sid = parts[0].strip()
            sname = roster.get(sid, parts[1].replace("_", " ").strip())
        else:
            sid = student_key.strip()
            sname = roster.get(sid, sid)

        # Check existing submission or create new
        submission = db.query(Submission).filter(
            Submission.assignment_id == assignment_id,
            Submission.student_identifier == sid,
        ).first()

        if not submission:
            submission = Submission(
                assignment_id=assignment_id,
                student_identifier=sid,
                student_name=sname,
                raw_archive_hash=archive_sha,
                storage_path=archive_path,
                status=SubmissionStatus.QUEUED,
            )
            db.add(submission)
            db.flush()
        else:
            submission.student_name = sname
            submission.raw_archive_hash = archive_sha
            submission.storage_path = archive_path
            # Clear previous files
            db.query(SubmissionFile).filter(SubmissionFile.submission_id == submission.id).delete()

        # Save files
        for rpath, content in files.items():
            sf = SubmissionFile(
                submission_id=submission.id,
                relative_path=rpath,
                file_content=content,
            )
            db.add(sf)
        db.commit()

        # Run pipeline
        try:
            process_single_submission(db, submission, files, assignment)
            created_count += 1
            details.append({"student_id": sid, "student_name": sname, "status": "PROCESSED"})
        except Exception as e:
            submission.status = SubmissionStatus.FLAGGED
            db.commit()
            details.append({"student_id": sid, "student_name": sname, "status": "ERROR", "error": str(e)})

    return BatchUploadSummary(
        assignment_id=assignment_id,
        total_found=total_found,
        created_count=created_count,
        skipped_count=total_found - created_count,
        details=details,
    )


@router.get("/assignments/{assignment_id}/submissions", response_model=List[SubmissionListItem])
def list_submissions(
    assignment_id: uuid.UUID,
    db: Session = Depends(get_db),
    lecturer: Lecturer = Depends(get_current_lecturer),
):
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment or assignment.course.lecturer_id != lecturer.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")

    submissions = db.query(Submission).filter(Submission.assignment_id == assignment_id).order_by(Submission.student_identifier.asc()).all()
    results = []

    for s in submissions:
        item = SubmissionListItem(
            id=s.id,
            assignment_id=s.assignment_id,
            student_identifier=s.student_identifier,
            student_name=s.student_name,
            submitted_at=s.submitted_at,
            status=s.status,
            automated_grade=s.lecturer_review.automated_grade if s.lecturer_review else None,
            final_grade=s.lecturer_review.final_grade if s.lecturer_review else None,
            review_status=s.lecturer_review.status if s.lecturer_review else None,
            execution_status=s.execution_result.status if s.execution_result else None,
            ai_risk_tier=s.ai_detection_signal.confidence_tier if s.ai_detection_signal else None,
        )
        results.append(item)

    return results


@router.get("/submissions/{submission_id}", response_model=SubmissionDetailResponse)
def get_submission_detail(
    submission_id: uuid.UUID,
    db: Session = Depends(get_db),
    lecturer: Lecturer = Depends(get_current_lecturer),
):
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission or submission.assignment.course.lecturer_id != lecturer.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")

    return SubmissionDetailResponse.model_validate(submission)


@router.post("/submissions/{submission_id}/re-evaluate", response_model=SubmissionDetailResponse)
def re_evaluate_submission(
    submission_id: uuid.UUID,
    db: Session = Depends(get_db),
    lecturer: Lecturer = Depends(get_current_lecturer),
):
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission or submission.assignment.course.lecturer_id != lecturer.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")

    files_dict = {f.relative_path: f.file_content for f in submission.files}
    process_single_submission(db, submission, files_dict, submission.assignment)
    db.refresh(submission)
    return SubmissionDetailResponse.model_validate(submission)
