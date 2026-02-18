"""
Safe path resolution utilities for the Haan.ai backend.

Ensures all file operations stay within the configured project root
to prevent path traversal attacks. Mirrors the TypeScript path-utils.ts.

Usage:
    from haan.utils.path_utils import safe_path, get_project_root

    abs_path = safe_path("src/main.py")       # Resolves relative to project root
    root = get_project_root()                  # Returns project root as string
"""

from __future__ import annotations

import os
from pathlib import Path


def get_project_root() -> str:
    """
    Return the project root directory as an absolute path string.

    Uses HAAN_PROJECT_ROOT env var if set, otherwise falls back to cwd.
    The result is always resolved (no symlinks or relative components).
    """
    root = os.environ.get("HAAN_PROJECT_ROOT", os.getcwd())
    return str(Path(root).resolve())


def safe_path(relative_path: str) -> str:
    """
    Resolve a path relative to the project root, ensuring it stays within bounds.

    Prevents directory traversal attacks by verifying the resolved path
    is a child of the project root.

    Args:
        relative_path: A file path, either relative to project root or absolute.

    Returns:
        Absolute resolved path string.

    Raises:
        ValueError: If the resolved path escapes the project root.
    """
    root = Path(get_project_root()).resolve()

    # If the path is already absolute, use it directly
    if os.path.isabs(relative_path):
        resolved = Path(relative_path).resolve()
    else:
        resolved = (root / relative_path).resolve()

    # Verify the resolved path is within the project root
    try:
        resolved.relative_to(root)
    except ValueError:
        raise ValueError(
            f"Path '{relative_path}' resolves to '{resolved}' which is outside "
            f"the project root '{root}'. Path traversal is not allowed."
        )

    return str(resolved)


def relative_path(absolute_path: str) -> str:
    """
    Convert an absolute path to a path relative to the project root.

    Args:
        absolute_path: An absolute file path.

    Returns:
        Path string relative to the project root, or the original path
        if it is not within the project root.
    """
    root = Path(get_project_root()).resolve()
    try:
        return str(Path(absolute_path).resolve().relative_to(root))
    except ValueError:
        return absolute_path


def haan_sub_dir(name: str) -> str:
    """
    Return the path to a subdirectory under the .haan project directory.

    Creates the directory if it does not exist. Used for storing
    checkpoints, memory, logs, and other persistent data.

    Args:
        name: Subdirectory name (e.g., "memory", "checkpoints", "logs").

    Returns:
        Absolute path to the subdirectory.
    """
    root = Path(get_project_root())
    sub = root / ".haan" / name
    sub.mkdir(parents=True, exist_ok=True)
    return str(sub)
