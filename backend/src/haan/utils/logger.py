"""
Structured logging for the Haan.ai backend.

Provides agent-aware, color-coded logging output with structured context.
Uses Python's standard logging module with a custom formatter.

Usage:
    from haan.utils.logger import logger

    logger.info("planner", "Starting plan generation", {"task": "Add auth"})
    logger.error("pipeline", "Stage failed", {"stage": "testing"})
"""

from __future__ import annotations

import logging
import sys
from typing import Any


# ANSI color codes for terminal output
COLORS = {
    "planner": "\033[38;5;141m",   # Purple (matches #A78BFA)
    "builder": "\033[38;5;214m",   # Amber/orange
    "tester": "\033[38;5;78m",     # Green
    "debugger": "\033[38;5;203m",  # Red
    "reviewer": "\033[38;5;75m",   # Blue
    "pipeline": "\033[38;5;220m",  # Gold
    "websocket": "\033[38;5;247m", # Gray
    "memory": "\033[38;5;183m",    # Light purple
    "shell-exec": "\033[38;5;208m",  # Orange
    "tools": "\033[38;5;117m",     # Light blue
}
RESET = "\033[0m"
DIM = "\033[2m"


class HaanFormatter(logging.Formatter):
    """
    Custom log formatter that adds agent context and colors.

    Output format:
        [HH:MM:SS] LEVEL  agent  message  {extra}
    """

    LEVEL_COLORS = {
        "DEBUG": "\033[38;5;245m",
        "INFO": "\033[38;5;40m",
        "WARNING": "\033[38;5;214m",
        "ERROR": "\033[38;5;196m",
        "CRITICAL": "\033[38;5;196m\033[1m",
    }

    def format(self, record: logging.LogRecord) -> str:
        """Format a log record with color and structured context."""
        # Extract haan-specific attributes
        agent = getattr(record, "agent", "")
        extra = getattr(record, "extra_data", None)

        # Time
        time_str = self.formatTime(record, "%H:%M:%S")

        # Level with color
        level_color = self.LEVEL_COLORS.get(record.levelname, "")
        level_str = f"{level_color}{record.levelname:<7}{RESET}"

        # Agent with color
        agent_color = COLORS.get(agent, "\033[38;5;252m")
        agent_str = f"{agent_color}{agent:<10}{RESET}" if agent else " " * 10

        # Message
        msg = record.getMessage()

        # Extra data
        extra_str = ""
        if extra and isinstance(extra, dict):
            parts = [f"{k}={v}" for k, v in extra.items()]
            extra_str = f"  {DIM}{' '.join(parts)}{RESET}"

        return f"{DIM}[{time_str}]{RESET} {level_str} {agent_str} {msg}{extra_str}"


class HaanLogger:
    """
    Structured logger wrapper for Haan.ai.

    Adds agent-aware logging methods that accept an agent name as the first
    argument, making it easy to trace which component produced each log line.
    """

    def __init__(self, name: str = "haan") -> None:
        self._logger = logging.getLogger(name)
        self._logger.setLevel(logging.DEBUG)

        # Add console handler with custom formatter if none exists
        if not self._logger.handlers:
            handler = logging.StreamHandler(sys.stderr)
            handler.setFormatter(HaanFormatter())
            self._logger.addHandler(handler)

    def set_level(self, level: str) -> None:
        """Set the logging level (debug, info, warning, error)."""
        numeric_level = getattr(logging, level.upper(), logging.INFO)
        self._logger.setLevel(numeric_level)

    def _log(
        self,
        level: int,
        agent: str,
        message: str,
        extra: dict[str, Any] | None = None,
    ) -> None:
        """Internal log method that attaches agent and extra data to the record."""
        self._logger.log(
            level,
            message,
            extra={"agent": agent, "extra_data": extra},
        )

    def debug(self, agent: str, message: str, extra: dict[str, Any] | None = None) -> None:
        """Log a debug message with agent context."""
        self._log(logging.DEBUG, agent, message, extra)

    def info(self, agent: str, message: str, extra: dict[str, Any] | None = None) -> None:
        """Log an info message with agent context."""
        self._log(logging.INFO, agent, message, extra)

    def warning(self, agent: str, message: str, extra: dict[str, Any] | None = None) -> None:
        """Log a warning message with agent context."""
        self._log(logging.WARNING, agent, message, extra)

    def warn(self, agent: str, message: str, extra: dict[str, Any] | None = None) -> None:
        """Alias for warning()."""
        self.warning(agent, message, extra)

    def error(self, agent: str, message: str, extra: dict[str, Any] | None = None) -> None:
        """Log an error message with agent context."""
        self._log(logging.ERROR, agent, message, extra)

    def critical(self, agent: str, message: str, extra: dict[str, Any] | None = None) -> None:
        """Log a critical message with agent context."""
        self._log(logging.CRITICAL, agent, message, extra)


# Module-level singleton
logger = HaanLogger()
