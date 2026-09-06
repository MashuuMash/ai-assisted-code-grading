from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, List, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from app.models import CriterionType, SubmissionStatus, ExecutionStatus, ConfidenceTier, ReviewStatus


# =====================================================================
# Auth & Lecturer
# =====================================================================

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: str = Field(min_length=2, max_length=150)

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    lecturer: LecturerResponse

class LecturerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    full_name: str
    created_at: datetime


# =====================================================================
# Course
# =====================================================================

class CourseCreate(BaseModel):
    code: str = Field(min_length=2, max_length=32)
    name: str = Field(min_length=2, max_length=200)
    semester: str = Field(min_length=2, max_length=32)

class CourseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    lecturer_id: uuid.UUID
    code: str
    name: str
    semester: str
    created_at: datetime
    assignment_count: Optional[int] = 0


# =====================================================================
# Rubric & Criteria
# =====================================================================

class RubricCriterionCreate(BaseModel):
    title: str = Field(min_length=1, max_length=150)
    criterion_type: CriterionType
    weight: Decimal = Field(ge=0, le=1)
    max_points: Decimal = Field(ge=0)
    evaluation_config: dict[str, Any] = Field(default_factory=dict)
    order_index: int = 0

class RubricCriterionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    rubric_id: uuid.UUID
    title: str
    criterion_type: CriterionType
    weight: Decimal
    max_points: Decimal
    evaluation_config: dict[str, Any]
    order_index: int

class RubricUpdate(BaseModel):
    title: Optional[str] = None
    criteria: List[RubricCriterionCreate]

class RubricResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    assignment_id: uuid.UUID
    title: str
    created_at: datetime
    criteria: List[RubricCriterionResponse] = []


# =====================================================================
# Test Case
# =====================================================================

class TestCaseCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    description: Optional[str] = None
    input_data: str
    expected_output: str
    is_hidden: bool = False
    weight: Decimal = Field(default=Decimal("1.00"), ge=0)
    timeout_ms: int = Field(default=3000, ge=50, le=60000)

class TestCaseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    assignment_id: uuid.UUID
    name: str
    description: Optional[str] = None
    input_data: str
    expected_output: str
    is_hidden: bool
    weight: Decimal
    timeout_ms: int


# =====================================================================
# Assignment
# =====================================================================

class AssignmentCreate(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    description: Optional[str] = None
    deadline: datetime
    max_score: Decimal = Field(default=Decimal("10.00"), gt=0)
    timeout_sec: int = Field(default=10, gt=0, le=600)
    memory_limit_mb: int = Field(default=256, ge=32, le=2048)
    test_cases: List[TestCaseCreate] = []
    rubric_criteria: Optional[List[RubricCriterionCreate]] = None

class AssignmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    course_id: uuid.UUID
    title: str
    description: Optional[str] = None
    deadline: datetime
    max_score: Decimal
    timeout_sec: int
    memory_limit_mb: int
    created_at: datetime
    test_cases_count: Optional[int] = 0
    submissions_count: Optional[int] = 0


# =====================================================================
# Submission & Telemetry
# =====================================================================

class SubmissionFileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    relative_path: str
    file_content: str

class ExecutionResultResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    status: ExecutionStatus
    passed_count: int
    failed_count: int
    total_count: int
    execution_time_ms: int
    test_details: list[Any] = []

class QualityMetricResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    cyclomatic_complexity_max: int
    cyclomatic_complexity_avg: Decimal
    max_nesting_depth: int
    loc_total: int
    function_count: int
    banned_imports_found: list[Any] = []
    ruff_violations: list[Any] = []

class AIDetectionSignalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    probability_score: Decimal
    confidence_tier: ConfidenceTier
    indicators: dict[str, Any]
    disclaimer: str

class AIFeedbackDraftResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    summary: str
    strengths: list[Any]
    weaknesses: list[Any]
    remediation_steps: list[Any]
    model_identifier: str
    created_at: datetime

class LecturerReviewCreate(BaseModel):
    final_grade: Decimal = Field(ge=0)
    grade_adjustments: dict[str, Any] = Field(default_factory=dict)
    feedback_override: Optional[str] = None
    status: ReviewStatus = ReviewStatus.APPROVED
    internal_notes: Optional[str] = None

class LecturerReviewResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    reviewer_id: Optional[uuid.UUID]
    automated_grade: Decimal
    final_grade: Decimal
    grade_adjustments: dict[str, Any]
    feedback_override: Optional[str]
    status: ReviewStatus
    internal_notes: Optional[str]
    reviewed_at: datetime
    version_id: int

class SubmissionListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    assignment_id: uuid.UUID
    student_identifier: str
    student_name: str
    submitted_at: datetime
    status: SubmissionStatus
    automated_grade: Optional[Decimal] = None
    final_grade: Optional[Decimal] = None
    review_status: Optional[ReviewStatus] = None
    execution_status: Optional[ExecutionStatus] = None
    ai_risk_tier: Optional[ConfidenceTier] = None
    max_similarity: Optional[Decimal] = None

class SubmissionDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    assignment_id: uuid.UUID
    student_identifier: str
    student_name: str
    submitted_at: datetime
    status: SubmissionStatus
    files: List[SubmissionFileResponse] = []
    execution_result: Optional[ExecutionResultResponse] = None
    quality_metric: Optional[QualityMetricResponse] = None
    ai_detection_signal: Optional[AIDetectionSignalResponse] = None
    ai_feedback_draft: Optional[AIFeedbackDraftResponse] = None
    lecturer_review: Optional[LecturerReviewResponse] = None


# =====================================================================
# Similarity Pair & Matrix
# =====================================================================

class SimilarityPairResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    assignment_id: uuid.UUID
    submission_a_id: uuid.UUID
    submission_b_id: uuid.UUID
    student_a_identifier: Optional[str] = None
    student_a_name: Optional[str] = None
    student_b_identifier: Optional[str] = None
    student_b_name: Optional[str] = None
    similarity_score: Decimal
    algorithm: str
    matched_spans: list[Any] = []

class SimilarityMatrixResponse(BaseModel):
    assignment_id: uuid.UUID
    threshold: Decimal
    total_pairs: int
    flagged_pairs: List[SimilarityPairResponse]


# =====================================================================
# Batch Upload Summary
# =====================================================================

class BatchUploadSummary(BaseModel):
    assignment_id: uuid.UUID
    total_found: int
    created_count: int
    skipped_count: int
    details: List[dict[str, Any]]
