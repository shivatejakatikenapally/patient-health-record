from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "development"
    app_name: str = "PS3 Health Record API"
    api_v1_prefix: str = "/api/v1"
    database_url: str
    redis_url: str
    supabase_url: str
    supabase_service_role_key: str
    supabase_storage_bucket: str = "patient-documents"
    jwt_secret_key: str
    jwt_access_token_minutes: int = 15
    web_origins: str = ""

    @field_validator("database_url")
    @classmethod
    def require_postgres(cls, value: str) -> str:
        if not value.startswith("postgresql+asyncpg://"):
            raise ValueError("DATABASE_URL must use hosted PostgreSQL with asyncpg")
        if "placeholder" in value.lower() or "USER:PASSWORD" in value:
            raise ValueError("DATABASE_URL still contains placeholder values")
        if make_url(value).host in {"localhost", "127.0.0.1", "::1"}:
            raise ValueError("DATABASE_URL must point to the hosted PostgreSQL instance")
        return value

    @field_validator("redis_url")
    @classmethod
    def require_hosted_redis(cls, value: str) -> str:
        if not value.startswith("rediss://") or "HOST" in value or "PASSWORD" in value:
            raise ValueError("REDIS_URL must be a TLS connection URL for hosted Redis")
        return value

    @field_validator("supabase_url")
    @classmethod
    def require_hosted_storage(cls, value: str) -> str:
        if not value.startswith("https://") or ".supabase.co" not in value:
            raise ValueError("SUPABASE_URL must be the hosted Supabase project URL")
        return value

    @field_validator("supabase_service_role_key")
    @classmethod
    def require_storage_key(cls, value: str) -> str:
        if len(value) < 40 or "replace" in value.lower():
            raise ValueError("SUPABASE_SERVICE_ROLE_KEY must be configured in a private secret store")
        return value

    @field_validator("jwt_secret_key")
    @classmethod
    def require_signing_key(cls, value: str) -> str:
        if len(value) < 32 or "replace" in value.lower():
            raise ValueError("JWT_SECRET_KEY must be at least 32 characters")
        return value


settings = Settings()
