from functools import lru_cache
from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        extra="ignore",
    )

    database_url: str = "postgresql+asyncpg://atoms:atoms@localhost:5432/atoms_demo"
    jwt_secret: str = "atoms-demo-dev-secret"
    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    openai_model: str = "gpt-4o-mini"
    github_token: str = ""
    github_api_url: str = "https://api.github.com"
    templates_root: str = "../templates"
    config_root: str = "../config"
    cors_origins: str = "http://localhost:3000"
    env: str = "development"

    @model_validator(mode="after")
    def normalize_database_url(self) -> "Settings":
        if self.database_url.startswith("postgresql://"):
            self.database_url = self.database_url.replace(
                "postgresql://", "postgresql+asyncpg://", 1
            )
        return self

    @model_validator(mode="after")
    def reject_default_jwt_in_production(self) -> "Settings":
        if self.is_production and self.jwt_secret == "atoms-demo-dev-secret":
            raise ValueError(
                "JWT_SECRET must be set to a non-default value in production"
            )
        return self

    @property
    def templates_path(self) -> Path:
        root = Path(__file__).parent / self.templates_root
        return root.resolve()

    @property
    def config_path(self) -> Path:
        root = Path(__file__).parent / self.config_root
        return root.resolve()

    @property
    def is_production(self) -> bool:
        return self.env == "production"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
