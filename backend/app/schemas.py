from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models import (
    AssignmentStatus,
    ComparisonReviewStatus,
    EvaluationType,
    EvidenceCategory,
    EvidenceSeverity,
    EvidenceSource,
    GradeStatus,
    GradingJobStatus,
    SimilarityStatus,
    TestOutcome,
    TestVisibility,
    UserRole,
)


class UserBase(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=50)
    full_name: str = Field(min_length=1, max_length=100)


class UserRegister(UserBase):
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    username_or_email: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: str
    user_id: int
    role: UserRole
    exp: int | None = None


class UserResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: UserRole
    is_active: bool
    created_at: datetime


class CourseBase(BaseModel):
    code: str = Field(min_length=2, max_length=50)
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None


class CourseCreate(CourseBase):
    pass


class CourseUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    is_active: bool | None = None


class CourseResponse(CourseBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    instructor_id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class ClassBase(BaseModel):
    code: str = Field(min_length=2, max_length=50)
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    semester: str = Field(min_length=1, max_length=50)
    year: int = Field(ge=2020, le=2100)


class ClassCreate(ClassBase):
    pass


class ClassUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    semester: str | None = Field(default=None, min_length=1, max_length=50)
    year: int | None = Field(default=None, ge=2020, le=2100)
    is_active: bool | None = None


class ClassResponse(ClassBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    course_id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class MembershipAdd(BaseModel):
    user_id: int


class MembershipResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    class_id: int
    joined_at: datetime
    user: UserResponse | None = None


class AssignmentBase(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    instructions: str | None = None
    language: str = Field(default="python", max_length=20)
    deadline: datetime | None = None
    base_code: str | None = None


class AssignmentCreate(AssignmentBase):
    status: AssignmentStatus = AssignmentStatus.DRAFT


class AssignmentUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    instructions: str | None = None
    language: str | None = Field(default=None, max_length=20)
    deadline: datetime | None = None
    status: AssignmentStatus | None = None
    base_code: str | None = None


class AssignmentResponse(AssignmentBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    class_id: int
    status: AssignmentStatus
    created_at: datetime
    updated_at: datetime


class SubmissionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    assignment_id: int
    student_id: int | None = None
    student_identifier: str = ""
    student_name: str | None = None
    original_filename: str
    size_bytes: int
    sha256: str
    submitted_at: datetime
    student: UserResponse | None = None


class BatchUploadItem(BaseModel):
    submission_id: int
    student_identifier: str
    student_name: str | None = None
    filename: str
    size_bytes: int
    job_id: int | None = None


class BatchUploadResponse(BaseModel):
    total_found: int
    imported_count: int
    failed_count: int
    submissions: list[BatchUploadItem]
    errors: list[str] = []


class EvidenceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    submission_id: int
    assignment_id: int
    source: EvidenceSource
    category: EvidenceCategory
    severity: EvidenceSeverity
    rule_code: str
    message: str
    location: str | None = None
    metric_value: float | None = None
    raw_data: dict | None = None
    created_at: datetime


class TestCaseBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    visibility: TestVisibility = TestVisibility.PUBLIC
    content: str = Field(min_length=1)


class TestCaseCreate(TestCaseBase):
    pass


class TestCaseUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    visibility: TestVisibility | None = None
    content: str | None = Field(default=None, min_length=1)


class TestCaseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    assignment_id: int
    name: str
    visibility: TestVisibility
    content: str | None = None
    created_at: datetime
    updated_at: datetime


class TestResultResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    test_case_id: int
    test_name: str
    outcome: TestOutcome
    duration_ms: int
    failure_type: str | None = None
    failure_detail: str | None = None


class GradingJobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    submission_id: int
    status: GradingJobStatus
    created_at: datetime
    started_at: datetime | None = None
    completed_at: datetime | None = None
    runtime_ms: int | None = None
    total_tests: int
    passed_tests: int
    failed_tests: int
    failure_type: str | None = None
    failure_information: str | None = None
    runner_output: str | None = None
    results: list[TestResultResponse] = []


class RubricCriterionBase(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    category: EvidenceCategory
    evaluation_type: EvaluationType
    weight_percentage: float = Field(gt=0, le=100)
    config: dict | None = None
    order_index: int = 0


class RubricCriterionCreate(RubricCriterionBase):
    pass


class RubricCriterionResponse(RubricCriterionBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    rubric_id: int
    max_points: float


class RubricBase(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    max_score: float = Field(gt=0, default=10.0)


class RubricCreate(RubricBase):
    criteria: list[RubricCriterionCreate] = []


class RubricUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    max_score: float | None = Field(default=None, gt=0)
    criteria: list[RubricCriterionCreate] | None = None


class RubricResponse(RubricBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    assignment_id: int
    created_at: datetime
    updated_at: datetime
    criteria: list[RubricCriterionResponse] = []


class CriterionScoreResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    criterion_id: int
    suggested_score: float
    final_score: float
    is_overridden: bool
    justification: str | None = None
    criterion: RubricCriterionResponse | None = None


class CriterionScoreOverride(BaseModel):
    criterion_id: int
    final_score: float = Field(ge=0)
    justification: str | None = None


class SubmissionGradeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    submission_id: int
    rubric_id: int
    suggested_total_score: float
    final_total_score: float | None = None
    status: GradeStatus
    feedback_summary: str | None = None
    detailed_feedback: dict | None = None
    graded_at: datetime
    confirmed_by_id: int | None = None
    criterion_scores: list[CriterionScoreResponse] = []


class SubmissionGradeOverride(BaseModel):
    final_total_score: float | None = None
    status: GradeStatus = GradeStatus.CONFIRMED
    feedback_summary: str | None = None
    detailed_feedback: dict | None = None
    criterion_overrides: list[CriterionScoreOverride] = []


class SimilarityRunRequest(BaseModel):
    threshold: float = Field(default=50.0, ge=0.0, le=100.0)


class SimilarityComparisonResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    report_id: int
    submission_a_id: int
    submission_b_id: int
    similarity_percentage: float
    matched_tokens: int
    status: ComparisonReviewStatus
    matched_regions: list | None = None
    review_notes: str | None = None


class SimilarityReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    assignment_id: int
    status: SimilarityStatus
    threshold_used: float
    submission_count: int
    avg_similarity: float | None = None
    max_similarity: float | None = None
    report_path: str | None = None
    error_message: str | None = None
    created_at: datetime
    completed_at: datetime | None = None


class SimilarityReportDetailResponse(SimilarityReportResponse):
    comparisons: list[SimilarityComparisonResponse] = []


class ComparisonReviewUpdate(BaseModel):
    status: ComparisonReviewStatus
    review_notes: str | None = None


class FeedbackImprovementItem(BaseModel):
    evidence_id: str
    criterion_title: str | None = None
    issue: str
    suggestion: str
    severity: EvidenceSeverity


class DetailedFeedbackPayload(BaseModel):
    summary: str
    strengths: list[str] = []
    areas_for_improvement: list[FeedbackImprovementItem] = []
    citations: list[str] = []


class FeedbackGenerateRequest(BaseModel):
    model_override: str | None = None


class FeedbackUpdate(BaseModel):
    feedback_summary: str | None = None
    detailed_feedback: dict | None = None
    status: GradeStatus | None = None


class SubmissionFeedbackResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    submission_id: int
    submission_grade_id: int
    status: GradeStatus
    suggested_total_score: float
    final_total_score: float | None = None
    feedback_summary: str | None = None
    detailed_feedback: dict | None = None
    citations: list[str] = []


class BatchFeedbackResponse(BaseModel):
    total_submissions: int
    generated_count: int
    failed_count: int
    results: list[dict] = []


class AiDetectionResponse(BaseModel):
    submission_id: int
    ai_probability: float
    classification: str
    confidence_score: float
    model_mode: str
    signals: list[str] = []
    evidence_id: str | None = None


class BatchAiDetectionResponse(BaseModel):
    total_analyzed: int
    high_probability_count: int
    results: list[AiDetectionResponse] = []



