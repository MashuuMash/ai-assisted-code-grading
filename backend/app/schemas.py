from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models import AssignmentStatus, UserRole


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
    student_id: int
    original_filename: str
    size_bytes: int
    sha256: str
    submitted_at: datetime
    student: UserResponse | None = None

