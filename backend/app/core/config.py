import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="allow")
    
    PROJECT_NAME: str = "PyGrade AI — Lecturer Portal"
    API_V1_PREFIX: str = "/api/v1"
    
    # Secret Key & JWT
    SECRET_KEY: str = "pygrade-insecure-development-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'pygrade.db'}")
    
    # Storage
    STORAGE_DIR: str = str(BASE_DIR / "storage")
    MAX_UPLOAD_SIZE_BYTES: int = 50 * 1024 * 1024  # 50 MB
    
    # Sandboxing & Execution
    DOCKER_IMAGE_NAME: str = "pygrade-sandbox:latest"
    EXECUTION_TIMEOUT_SEC: int = 10
    MEMORY_LIMIT_MB: int = 256
    
    # Static Analysis
    RUFF_EXECUTABLE: str = "ruff"
    
    # AI Keys (Optional)
    OPENAI_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    
    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

settings = Settings()

# Ensure storage directory exists
Path(settings.STORAGE_DIR).mkdir(parents=True, exist_ok=True)
