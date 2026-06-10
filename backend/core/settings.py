from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file="../.env", env_file_encoding="utf-8", extra="ignore")

    SECRET_KEY: str = "dev-secret-change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    ENVIRONMENT: str = "development"
    DATABASE_URL: str = "sqlite:///./db/homeplatform.sqlite"
    SENTRY_DSN: str = ""
    SENTRY_MIN_LEVEL: str = "warning"
    MUSIC_DIR: str = "/app/music"
    NAS_URL: str = ""

    @property
    def is_dev(self) -> bool:
        return self.ENVIRONMENT == "development"


settings = Settings()
