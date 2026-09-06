from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_lecturer
from app.core.security import create_access_token, hash_password, verify_password
from app.models import Lecturer
from app.schemas import LecturerResponse, LoginRequest, RegisterRequest, TokenResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register_lecturer(req: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(Lecturer).filter(Lecturer.email == req.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A lecturer with this email address already exists",
        )

    lecturer = Lecturer(
        email=req.email,
        hashed_password=hash_password(req.password),
        full_name=req.full_name,
    )
    db.add(lecturer)
    db.commit()
    db.refresh(lecturer)

    token = create_access_token(subject=lecturer.id)
    return TokenResponse(
        access_token=token,
        lecturer=LecturerResponse.model_validate(lecturer),
    )

@router.post("/login", response_model=TokenResponse)
def login_lecturer(req: LoginRequest, db: Session = Depends(get_db)):
    lecturer = db.query(Lecturer).filter(Lecturer.email == req.email).first()
    if not lecturer or not verify_password(req.password, lecturer.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    token = create_access_token(subject=lecturer.id)
    return TokenResponse(
        access_token=token,
        lecturer=LecturerResponse.model_validate(lecturer),
    )

@router.get("/me", response_model=LecturerResponse)
def get_me(current_lecturer: Lecturer = Depends(get_current_lecturer)):
    return LecturerResponse.model_validate(current_lecturer)
