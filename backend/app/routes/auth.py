from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.auth import create_access_token, get_current_user, get_password_hash, verify_password
from app.config import get_settings
from app.database import get_db
from app.email_service import generate_otp_code, hash_otp_code, send_otp_email, verify_otp_code
from app.models import User, UserRole, utc_now
from app.rate_limit import rate_limit
from app.schemas import (
    ChangePasswordRequest,
    ChangePasswordResponse,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    OtpResendRequest,
    OtpResendResponse,
    OtpVerifyRequest,
    ResetPasswordRequest,
    ResetPasswordResponse,
    Token,
    UserLogin,
    UserRegister,
    UserResponse,
    UserUpdate,
)

router = APIRouter(prefix="/auth", tags=["auth"])

MAX_OTP_ATTEMPTS = 5


def _ensure_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _mask_email(email: str) -> str:
    if "@" not in email:
        return email
    local, domain = email.split("@", 1)
    if len(local) <= 2:
        masked_local = local[0] + "*"
    else:
        masked_local = local[0] + "*" * (len(local) - 2) + local[-1]
    return f"{masked_local}@{domain}"


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit("auth_register", max_requests=15, window_seconds=60))],
)
def register(user_in: UserRegister, db: Annotated[Session, Depends(get_db)]) -> UserResponse:
    settings = get_settings()
    existing_users = list(
        db.scalars(
            select(User).where(or_(User.email == user_in.email, User.username == user_in.username))
        )
    )

    for existing in existing_users:
        if existing.is_email_verified:
            if existing.email == user_in.email:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email is already registered",
                )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username is already taken",
            )

    # Replace any unverified pending registration for the same email/username
    for unverified in existing_users:
        db.delete(unverified)
    if existing_users:
        db.flush()

    otp_code = generate_otp_code()
    otp_expires = utc_now() + timedelta(minutes=settings.otp_expire_minutes)

    # Public registration creates a lecturer account pending 6-digit OTP verification
    user = User(
        email=user_in.email,
        username=user_in.username,
        full_name=user_in.full_name,
        hashed_password=get_password_hash(user_in.password),
        role=UserRole.LECTURER,
        is_active=True,
        is_email_verified=False,
        otp_code_hash=hash_otp_code(otp_code),
        otp_expires_at=otp_expires,
        otp_attempts=0,
    )
    db.add(user)
    db.flush()

    try:
        send_otp_email(
            recipient_email=user.email,
            full_name=user.full_name,
            username=user.username,
            otp_code=otp_code,
        )
    except RuntimeError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    db.commit()
    db.refresh(user)

    return UserResponse(
        id=user.id,
        email=user.email,
        username=user.username,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
        is_email_verified=user.is_email_verified,
        otp_required=True,
        created_at=user.created_at,
    )


@router.post(
    "/verify-otp",
    response_model=Token,
    dependencies=[Depends(rate_limit("auth_otp", max_requests=15, window_seconds=60))],
)
def verify_otp(
    payload: OtpVerifyRequest,
    db: Annotated[Session, Depends(get_db)],
) -> Token:
    identifier = payload.email_or_username.strip()
    user = db.scalar(
        select(User).where(or_(User.email == identifier, User.username == identifier))
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found",
        )

    if user.is_email_verified:
        token = create_access_token(
            data={"sub": user.username, "user_id": user.id, "role": user.role.value}
        )
        return Token(access_token=token, token_type="bearer")

    if user.otp_attempts >= MAX_OTP_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many invalid OTP attempts. Please request a new verification code.",
        )

    expires_at = _ensure_utc(user.otp_expires_at)
    if not expires_at or utc_now() > expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired. Please request a new code.",
        )

    if not verify_otp_code(payload.otp_code, user.otp_code_hash):
        user.otp_attempts += 1
        db.commit()
        remaining = max(0, MAX_OTP_ATTEMPTS - user.otp_attempts)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid verification code ({remaining} attempts remaining).",
        )

    user.is_email_verified = True
    user.is_active = True
    user.otp_code_hash = None
    user.otp_expires_at = None
    user.otp_attempts = 0
    db.commit()
    db.refresh(user)

    token = create_access_token(
        data={"sub": user.username, "user_id": user.id, "role": user.role.value}
    )
    return Token(access_token=token, token_type="bearer")


@router.post(
    "/resend-otp",
    response_model=OtpResendResponse,
    dependencies=[Depends(rate_limit("auth_otp", max_requests=15, window_seconds=60))],
)
def resend_otp(
    payload: OtpResendRequest,
    db: Annotated[Session, Depends(get_db)],
) -> OtpResendResponse:
    settings = get_settings()
    identifier = payload.email_or_username.strip()
    user = db.scalar(
        select(User).where(or_(User.email == identifier, User.username == identifier))
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found",
        )

    if user.is_email_verified:
        return OtpResendResponse(
            message="Email is already verified",
            email=user.email,
            otp_required=False,
        )

    otp_code = generate_otp_code()
    user.otp_code_hash = hash_otp_code(otp_code)
    user.otp_expires_at = utc_now() + timedelta(minutes=settings.otp_expire_minutes)
    user.otp_attempts = 0

    try:
        send_otp_email(
            recipient_email=user.email,
            full_name=user.full_name,
            username=user.username,
            otp_code=otp_code,
        )
    except RuntimeError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    db.commit()

    return OtpResendResponse(
        message="A new 6-digit verification code has been sent to your email.",
        email=user.email,
        otp_required=True,
    )


def _inactive_account_detail() -> str:
    settings = get_settings()
    contact = (
        settings.support_email.strip()
        or settings.smtp_from_email.strip()
        or settings.smtp_user.strip()
        or "admin@veripie.id.vn"
    )
    return f"Account is deactivated. Please contact {contact} to reactivate your account."


@router.post(
    "/login",
    response_model=Token,
    dependencies=[Depends(rate_limit("auth_login", max_requests=20, window_seconds=60))],
)
def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Annotated[Session, Depends(get_db)],
) -> Token:
    identifier = form_data.username.strip()
    user = db.scalar(
        select(User).where(or_(User.username == identifier, User.email == identifier))
    )
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=_inactive_account_detail(),
        )
    if not user.is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email verification required. Please enter the 6-digit OTP code sent to your email.",
        )

    token = create_access_token(
        data={"sub": user.username, "user_id": user.id, "role": user.role.value}
    )
    return Token(access_token=token, token_type="bearer")


@router.post(
    "/login/json",
    response_model=Token,
    dependencies=[Depends(rate_limit("auth_login", max_requests=20, window_seconds=60))],
)
def login_json(
    credentials: UserLogin,
    db: Annotated[Session, Depends(get_db)],
) -> Token:
    identifier = credentials.username_or_email.strip()
    user = db.scalar(
        select(User).where(or_(User.username == identifier, User.email == identifier))
    )
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=_inactive_account_detail(),
        )
    if not user.is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email verification required. Please enter the 6-digit OTP code sent to your email.",
        )

    token = create_access_token(
        data={"sub": user.username, "user_id": user.id, "role": user.role.value}
    )
    return Token(access_token=token, token_type="bearer")


@router.get("/me", response_model=UserResponse)
def get_me(current_user: Annotated[User, Depends(get_current_user)]) -> User:
    return current_user


@router.patch("/me", response_model=UserResponse)
def update_me(
    payload: UserUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    if payload.full_name is not None:
        clean_name = payload.full_name.strip()
        if not clean_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Full name cannot be blank",
            )
        current_user.full_name = clean_name
        db.commit()
        db.refresh(current_user)
    return current_user


@router.post("/change-password", response_model=ChangePasswordResponse)
def change_password(
    payload: ChangePasswordRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> ChangePasswordResponse:
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    if verify_password(payload.new_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password cannot be the same as your current password",
        )
    current_user.hashed_password = get_password_hash(payload.new_password)
    db.commit()
    return ChangePasswordResponse(message="Password changed successfully")


@router.post(
    "/forgot-password",
    response_model=ForgotPasswordResponse,
    dependencies=[Depends(rate_limit("auth_forgot", max_requests=15, window_seconds=60))],
)
def forgot_password(
    payload: ForgotPasswordRequest,
    db: Annotated[Session, Depends(get_db)],
) -> ForgotPasswordResponse:
    settings = get_settings()
    identifier = payload.email_or_username.strip()
    user = db.scalar(
        select(User).where(or_(User.email == identifier.lower(), User.username == identifier.lower()))
    )
    if not user:
        return ForgotPasswordResponse(
            message="If an account with that email or username exists, a verification code has been sent."
        )

    otp_code = generate_otp_code()
    user.otp_code_hash = hash_otp_code(otp_code)
    user.otp_expires_at = utc_now() + timedelta(minutes=settings.otp_expire_minutes)
    user.otp_attempts = 0

    try:
        send_otp_email(
            recipient_email=user.email,
            full_name=user.full_name,
            username=user.username,
            otp_code=otp_code,
            purpose="reset_password",
        )
    except RuntimeError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    db.commit()

    return ForgotPasswordResponse(
        message="A password reset verification code has been sent to your email.",
        email_hint=_mask_email(user.email),
    )


@router.post(
    "/reset-password",
    response_model=ResetPasswordResponse,
    dependencies=[Depends(rate_limit("auth_forgot", max_requests=15, window_seconds=60))],
)
def reset_password(
    payload: ResetPasswordRequest,
    db: Annotated[Session, Depends(get_db)],
) -> ResetPasswordResponse:
    identifier = payload.email_or_username.strip()
    user = db.scalar(
        select(User).where(or_(User.email == identifier.lower(), User.username == identifier.lower()))
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid request or verification code.",
        )

    if user.otp_attempts >= MAX_OTP_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many invalid OTP attempts. Please request a new verification code.",
        )

    expires_at = _ensure_utc(user.otp_expires_at)
    if not expires_at or utc_now() > expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired. Please request a new code.",
        )

    if not verify_otp_code(payload.otp_code, user.otp_code_hash):
        user.otp_attempts += 1
        db.commit()
        remaining = max(0, MAX_OTP_ATTEMPTS - user.otp_attempts)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid verification code ({remaining} attempts remaining).",
        )

    if verify_password(payload.new_password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password cannot be the same as your old password.",
        )

    user.hashed_password = get_password_hash(payload.new_password)
    user.otp_code_hash = None
    user.otp_expires_at = None
    user.otp_attempts = 0
    user.is_email_verified = True
    user.is_active = True
    db.commit()
    db.refresh(user)

    token = create_access_token(
        data={"sub": user.username, "user_id": user.id, "role": user.role.value}
    )
    return ResetPasswordResponse(
        message="Password reset successfully. You are now logged in.",
        access_token=token,
        token_type="bearer",
    )
