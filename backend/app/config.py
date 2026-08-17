from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    database_url: str
    secret_key: str = Field(min_length=32)
    algorithm: str = "HS256"
    access_token_expire_minutes: int = Field(default=30, ge=5, le=1440)
    app_name: str = "AI-Assisted Code Grading Platform"
    debug: bool = False
    cors_origins: str = "http://localhost:3000"
    submission_storage_path: str = "/data/submissions"
    submission_max_bytes: int = Field(default=262_144, ge=1, le=5_242_880)
    grading_poll_seconds: float = Field(default=1.0, ge=0.1, le=60)
    grading_timeout_seconds: int = Field(default=10, ge=1, le=120)
    grading_memory: str = "128m"
    grading_cpus: float = Field(default=0.5, gt=0, le=2)
    grading_pids_limit: int = Field(default=64, ge=16, le=256)
    grading_output_max_bytes: int = Field(default=32_768, ge=1024, le=1_048_576)
    grading_max_test_cases: int = Field(default=100, ge=1, le=500)
    grading_sandbox_image: str = "ai-grading-sandbox:latest"

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
