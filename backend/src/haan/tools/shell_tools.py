"""
Shell execution tool for Haan.ai agents.

Provides safe shell command execution with:
- Dangerous command blocking (rm -rf /, mkfs, dd, fork bombs)
- Configurable timeout (default 60s, max 300s)
- Output truncation with head+tail preservation
- ANSI escape stripping for clean output
"""

from __future__ import annotations

import os
import re
import subprocess

from crewai.tools import BaseTool as CrewAIBaseTool

from haan.utils.logger import logger
from haan.utils.path_utils import get_project_root, safe_path

# Maximum output size in characters
MAX_OUTPUT = 30_000

# Default timeout in seconds
DEFAULT_TIMEOUT = 60

# Patterns for dangerous commands that should be blocked
BLOCKED_PATTERNS = [
    re.compile(r"\brm\s+(-rf?|--recursive)\s+[/~]", re.IGNORECASE),
    re.compile(r"\bmkfs\b", re.IGNORECASE),
    re.compile(r"\bdd\s+.*of=/dev/", re.IGNORECASE),
    re.compile(r":\(\)\{\s*:\|:&\s*\};:"),  # Fork bomb
]


class ShellExecTool(CrewAIBaseTool):
    """Execute a shell command and return stdout/stderr."""

    name: str = "shell-exec"
    description: str = (
        "Execute a shell command and return stdout and stderr. "
        "Default timeout is 60 seconds. Output is truncated to 30000 characters. "
        "Dangerous commands (rm -rf /, mkfs, dd, fork bombs) are blocked."
    )

    def _run(
        self,
        command: str,
        cwd: str | None = None,
        timeout: int | None = None,
    ) -> str:
        """
        Execute a shell command.

        Args:
            command: Shell command to execute.
            cwd: Working directory (relative to project root, defaults to project root).
            timeout: Timeout in seconds (default 60, max 300).

        Returns:
            Command output (stdout + stderr), or error message.
        """
        effective_timeout = min(timeout or DEFAULT_TIMEOUT, 300)

        # Resolve working directory
        try:
            work_dir = safe_path(cwd) if cwd else get_project_root()
        except ValueError as e:
            return f"Error: Invalid working directory: {e}"

        # Safety check: block dangerous commands
        skip_permissions = os.environ.get("HAAN_SKIP_PERMISSIONS", "false").lower() == "true"
        if not skip_permissions:
            for pattern in BLOCKED_PATTERNS:
                if pattern.search(command):
                    return (
                        f"Error: Command blocked for safety: \"{command}\". "
                        "Set HAAN_SKIP_PERMISSIONS=true to bypass."
                    )

        logger.info("shell-exec", f"Running: {command}", {"cwd": work_dir})

        try:
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=effective_timeout,
                cwd=work_dir,
                env={**os.environ, "FORCE_COLOR": "0", "NO_COLOR": "1"},
            )

            # Combine stdout and stderr
            output = result.stdout
            if result.stderr:
                if output:
                    output += "\n--- stderr ---\n"
                output += result.stderr

            formatted = self._format_output(output)

            if result.returncode != 0:
                return f"Exit code {result.returncode}:\n{formatted}"

            return formatted

        except subprocess.TimeoutExpired:
            return f"Error: Command timed out after {effective_timeout}s: \"{command}\""
        except Exception as e:
            return f"Error: Command failed: {e}"

    @staticmethod
    def _format_output(output: str) -> str:
        """Clean and truncate command output."""
        if not output or not output.strip():
            return "(no output)"

        # Strip ANSI escape sequences
        result = re.sub(r"\x1B\[[0-9;]*[a-zA-Z]", "", output)
        result = re.sub(r"\x1B\][^\x07]*\x07", "", result)

        # Truncate if needed, keeping both head and tail
        if len(result) > MAX_OUTPUT:
            head_size = int(MAX_OUTPUT * 0.7)
            tail_size = MAX_OUTPUT - head_size - 100
            omitted = len(result) - head_size - tail_size
            head = result[:head_size]
            tail = result[-tail_size:]
            result = f"{head}\n\n... [{omitted} characters omitted] ...\n\n{tail}"

        return result
