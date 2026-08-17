from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models import AssignmentStatus, GradingJobStatus, TestOutcome, TestVisibility, UserRole


class UserRegistration(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=128, pattern=r"^[A-Za-z0-9_.-]+$")
    full_name: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=12, max_length=72)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: EmailStr
    username: str
    full_name: str
    role: UserRole
    is_active: bool
    created_at: datetime
    updated_at: datetime


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class CourseCreate(BaseModel):
    code: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=5000)


class CourseUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=5000)
    is_active: bool | None = None


class CourseResponse(CourseCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    instructor_id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class ClassCreate(BaseModel):
    code: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=5000)
    semester: str = Field(min_length=1, max_length=50)
    year: int = Field(ge=2000, le=2200)


class ClassUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=5000)
    semester: str | None = Field(default=None, min_length=1, max_length=50)
    year: int | None = Field(default=None, ge=2000, le=2200)
    is_active: bool | None = None


class ClassResponse(ClassCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    course_id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class MembershipResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    class_id: int
    joined_at: datetime
    user: UserResponse


class AssignmentCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=20_000)
    instructions: str | None = Field(default=None, max_length=50_000)
    language: str = Field(default="python", pattern="^python$")
    deadline: datetime | None = None
    status: AssignmentStatus = AssignmentStatus.DRAFT

    @field_validator("deadline")
    @classmethod
    def deadline_must_include_timezone(cls, value: datetime | None) -> datetime | None:
        if value is not None and value.tzinfo is None:
            raise ValueError("deadline must include a timezone")
        return value


class AssignmentUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=20_000)
    instructions: str | None = Field(default=None, max_length=50_000)
    deadline: datetime | None = None
    status: AssignmentStatus | None = None

    @field_validator("deadline")
    @classmethod
    def deadline_must_include_timezone(cls, value: datetime | None) -> datetime | None:
        if value is not None and value.tzinfo is None:
            raise ValueError("deadline must include a timezone")
        return value


class AssignmentResponse(AssignmentCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    class_id: int
    created_at: datetime
    updated_at: datetime


class SubmissionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    assignment_id: int
    student_id: int
    original_filename: str
    size_bytes: int
    sha256: str
    submitted_at: datetime


class TestCaseCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    visibility: TestVisibility
    content: str = Field(min_length=1, max_length=50_000)


class TestCaseUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    visibility: TestVisibility | None = None
    content: str | None = Field(default=None, min_length=1, max_length=50_000)


class TestCaseResponse(BaseModel):
    id: int
    assignment_id: int
    name: str
    visibility: TestVisibility
    content: str | None
    created_at: datetime
    updated_at: datetime


class TestResultResponse(BaseModel):
    id: int
    test_case_id: int | None
    test_name: str
    visibility: TestVisibility
    outcome: TestOutcome
    duration_ms: int
    failure_type: str | None
    failure_detail: str | None


class GradingJobResponse(BaseModel):
    id: int
    submission_id: int
    status: GradingJobStatus
    created_at: datetime
    started_at: datetime | None
    completed_at: datetime | None
    runtime_ms: int | None
    total_tests: int
    passed_tests: int
    failed_tests: int
    failure_type: str | None
    failure_information: str | None
    runner_output: str | None
    results: list[TestResultResponse]
