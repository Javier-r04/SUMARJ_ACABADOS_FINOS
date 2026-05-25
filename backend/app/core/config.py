"""Configuración global de la aplicación."""
import os
import secrets

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Base de datos: Render/Neon inyectarán esta variable automáticamente.
    # Fallback local para desarrollo con Docker Compose.
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg2://sumarj:sumarj_password@db:5432/sumarj_db",
    )

    # Secret key: en producción debe venir de variable de entorno.
    SECRET_KEY: str = os.getenv("SECRET_KEY") or secrets.token_urlsafe(32)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    # Detectar si estamos en producción
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

    @property
    def IS_PRODUCTION(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"


settings = Settings()


def _fix_database_url(url: str) -> str:
    """
    Neon y Render usan el formato 'postgres://' pero SQLAlchemy 2.0
    requiere 'postgresql+psycopg2://'. Esta función normaliza la URL.
    """
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+psycopg2://", 1)
    elif url.startswith("postgresql://") and "+psycopg2" not in url:
        url = url.replace("postgresql://", "postgresql+psycopg2://", 1)
    return url


settings.DATABASE_URL = _fix_database_url(settings.DATABASE_URL)
