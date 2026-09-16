from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "AI-Assisted Code Grading Platform"
    app_version: str = "0.1.0"
    debug: bool = False

    database_url: str = "postgresql://postgres:postgres@localhost:5432/grading_db"

    secret_key: str = "dev-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440

    submission_storage_path: Path = Path("./submission_data")
    submission_max_bytes: int = 262144

    grading_sandbox_image: str = "grading-sandbox:latest"
    grading_timeout_seconds: int = 10
    grading_memory: str = "256m"
    grading_cpus: float = 1.0
    grading_pids_limit: int = 64

    ai_provider: str = "gemini"
    gemini_api_key: str = ""
    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    ai_model: str = "gemini-2.5-flash"


@lru_cache
def get_settings() -> Settings:
    return Settings()
