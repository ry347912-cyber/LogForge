"""
LogForge Configuration Settings
Centralizes all environment-based configuration.
"""

from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "LogForge"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Security
    SECRET_KEY: str = "logforge-super-secret-key-change-in-production-2024"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./logforge.db"

    # CORS
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://localhost:8080",
    ]

    # Log Settings
    MAX_LOG_RETENTION_DAYS: int = 30
    MAX_LOGS_PER_PAGE: int = 100
    LOG_STORAGE_PATH: str = "./logs"

    # Alert Thresholds
    FAILED_LOGIN_THRESHOLD: int = 5        # Alerts after N failed logins
    BRUTE_FORCE_WINDOW_SECONDS: int = 300  # 5-minute window
    ANOMALY_SCORE_THRESHOLD: float = 0.7   # Isolation Forest score
    CPU_ALERT_THRESHOLD: float = 90.0      # CPU % threshold

    # ML Settings
    ANOMALY_DETECTION_ENABLED: bool = True
    MIN_LOGS_FOR_TRAINING: int = 100

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
