from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routes.ai_detector import router as ai_detector_router
from app.routes.assignments import router as assignments_router
from app.routes.auth import router as auth_router
from app.routes.classes import router as classes_router
from app.routes.courses import router as courses_router
from app.routes.feedback import router as feedback_router
from app.routes.grading import router as grading_router
from app.routes.rubrics import router as rubrics_router
from app.routes.similarity import router as similarity_router

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    debug=settings.debug,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/v1")
app.include_router(courses_router, prefix="/api/v1")
app.include_router(classes_router, prefix="/api/v1")
app.include_router(assignments_router, prefix="/api/v1")
app.include_router(grading_router, prefix="/api/v1")
app.include_router(rubrics_router, prefix="/api/v1")
app.include_router(similarity_router, prefix="/api/v1")
app.include_router(feedback_router, prefix="/api/v1")
app.include_router(ai_detector_router, prefix="/api/v1")


@app.get("/health", tags=["health"])
def health_check() -> dict[str, str]:
    return {
        "status": "healthy",
        "app": settings.app_name,
        "version": settings.app_version,
    }
