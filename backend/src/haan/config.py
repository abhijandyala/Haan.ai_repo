"""
Application configuration using Pydantic Settings.

Loads settings from environment variables and .env file.
All configuration is centralized here for easy discovery and validation.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Central configuration for the Haan.ai backend.

    Environment variables are prefixed with HAAN_ (except API keys).
    Values can also be set in a .env file at the project root.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── LLM Provider API Keys ──
    anthropic_api_key: str = Field(default="", alias="ANTHROPIC_API_KEY")
    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")
    google_api_key: str = Field(default="", alias="GOOGLE_API_KEY")

    # ── Default LLM Settings ──
    default_provider: Literal["anthropic", "openai", "google"] = Field(
        default="anthropic",
        alias="HAAN_DEFAULT_PROVIDER",
    )
    default_model: str = Field(
        default="claude-sonnet-4-20250514",
        alias="HAAN_DEFAULT_MODEL",
    )

    # ── Server Settings ──
    host: str = Field(default="127.0.0.1", alias="HAAN_HOST")
    port: int = Field(default=8000, alias="HAAN_PORT")
    log_level: Literal["debug", "info", "warning", "error"] = Field(
        default="info",
        alias="HAAN_LOG_LEVEL",
    )

    # ── Project Root ──
    project_root: str = Field(
        default_factory=lambda: os.getcwd(),
        alias="HAAN_PROJECT_ROOT",
    )

    # ── Pipeline Settings ──
    max_retries: int = Field(default=3, alias="HAAN_MAX_RETRIES")
    max_improvement_passes: int = Field(default=2, alias="HAAN_MAX_IMPROVEMENT_PASSES")
    stage_timeout: int = Field(default=300_000, alias="HAAN_STAGE_TIMEOUT")

    # ── Budget Limits (USD, 0 = unlimited) ──
    budget_per_task: float = Field(default=0.0, alias="HAAN_BUDGET_PER_TASK")
    budget_daily: float = Field(default=0.0, alias="HAAN_BUDGET_DAILY")

    # ── Security ──
    skip_permissions: bool = Field(default=False, alias="HAAN_SKIP_PERMISSIONS")

    @property
    def project_root_path(self) -> Path:
        """Return project root as a resolved Path object."""
        return Path(self.project_root).resolve()


# Module-level singleton — imported elsewhere as `from haan.config import settings`
settings = Settings()
