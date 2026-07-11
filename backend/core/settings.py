from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file="../.env", env_file_encoding="utf-8", extra="ignore")

    SECRET_KEY: str = "dev-secret-change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    APP_VERSION: str = "0.8"
    ENVIRONMENT: str = "development"
    DATABASE_URL: str = "sqlite:///./db/homeplatform.sqlite"
    SENTRY_DSN: str = ""
    SENTRY_MIN_LEVEL: str = "warning"
    MUSIC_DIR: str = "/app/music"
    NAS_URL: str = ""
    EXTERNAL_URL: str = ""
    UPLOAD_ROOT: str = "/app/uploads"
    DOWNLOAD_DIR: str = "/app/downloads"
    BEATPORTDL_CONFIG_DIR: str = ""  # pad naar beatportdl config-map (optioneel)
    CORS_ORIGINS: str = ""  # kommagescheiden; leeg = automatisch op basis van omgeving

    @property
    def is_dev(self) -> bool:
        return self.ENVIRONMENT == "development"

    @property
    def cors_origins(self) -> list[str]:
        if self.CORS_ORIGINS:
            return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]
        if self.is_dev:
            return ["http://localhost:5172", "http://localhost:3000"]
        return []


settings = Settings()
