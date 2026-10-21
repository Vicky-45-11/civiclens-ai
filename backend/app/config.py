from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All configuration comes from environment variables (see .env.example)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://civiclens:civiclens@localhost:5432/civiclens"
    # No default on purpose in production: main.py refuses to start with the dev value outside APP_ENV=development.
    jwt_secret: str = "dev-only-change-me-dev-only-change-me"
    jwt_ttl_minutes: int = 60 * 12
    app_env: str = "development"
    cookie_secure: bool = False
    cors_origins: str = "http://localhost:3000"

    # Object storage: "local" writes under STORAGE_DIR, "s3" uses any S3-compatible service.
    storage_backend: str = "local"
    storage_dir: str = "./storage"
    s3_endpoint_url: str | None = None
    s3_bucket: str = "civiclens"
    s3_region: str = "us-east-1"
    s3_access_key: str | None = None
    s3_secret_key: str | None = None

    max_upload_bytes: int = 6 * 1024 * 1024
    max_photos_per_issue: int = 4

    # AI
    model_path: str | None = None  # path to a trained .pt checkpoint, see ai/train.py
    duplicate_radius_m: float = 60.0
    duplicate_phash_distance: int = 10

    # Rate limits (per window of 60 seconds), in-process. See README for multi-instance deployments.
    rate_limit_auth_per_min: int = 10
    rate_limit_submit_per_min: int = 6
    rate_limit_write_per_min: int = 40
    rate_limit_read_per_min: int = 240

    # Optional first admin created by scripts/seed.py or on startup when set.
    admin_email: str | None = None
    admin_password: str | None = Field(default=None, repr=False)

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
