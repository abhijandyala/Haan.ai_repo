"""
File manipulation tools for Haan.ai agents.

Provides 7 tools that mirror the TypeScript file-tools.ts:
- FileReadTool:   Read file contents with optional line range
- FileWriteTool:  Write/create files with auto-directory creation
- FileEditTool:   Find-and-replace editing with uniqueness validation
- FileDeleteTool: Delete files safely
- FileSearchTool: Grep/ripgrep-based content search
- FileGlobTool:   Glob pattern file discovery
- FileListTool:   Directory listing (flat or recursive)
"""

from __future__ import annotations

import fnmatch
import os
import re
import subprocess
from pathlib import Path
from typing import Any

from crewai.tools import BaseTool as CrewAIBaseTool
from pydantic import Field

from haan.utils.path_utils import get_project_root, relative_path, safe_path


class FileReadTool(CrewAIBaseTool):
    """Read the contents of a file, optionally a specific line range."""

    name: str = "file-read"
    description: str = (
        "Read the contents of a file. Optionally specify startLine and endLine "
        "(1-based, inclusive) to read a specific range. Returns numbered lines."
    )

    def _run(
        self,
        path: str,
        startLine: int | None = None,
        endLine: int | None = None,
    ) -> str:
        """
        Read a file and return its contents with line numbers.

        Args:
            path: File path relative to project root.
            startLine: Starting line number (1-based, default: 1).
            endLine: Ending line number (1-based inclusive, default: last line).

        Returns:
            File contents with line numbers, or an error message.
        """
        try:
            file_path = safe_path(path)
            p = Path(file_path)
            if not p.exists():
                return f"Error: File not found: {path}"
            if p.is_dir():
                return f"Error: Path is a directory, not a file: {path}"

            content = p.read_text(encoding="utf-8", errors="replace")
            lines = content.split("\n")

            start = max(1, startLine or 1) - 1
            end = min(len(lines), endLine or len(lines))
            selected = lines[start:end]

            numbered = "\n".join(
                f"{start + i + 1}\t{line}" for i, line in enumerate(selected)
            )
            return numbered
        except Exception as e:
            return f"Error: Failed to read file: {e}"


class FileWriteTool(CrewAIBaseTool):
    """Write content to a file, creating directories as needed."""

    name: str = "file-write"
    description: str = (
        "Write content to a file. Creates the file and any parent directories "
        "if they do not exist. Overwrites existing content."
    )

    def _run(self, path: str, content: str) -> str:
        """
        Write content to a file.

        Args:
            path: File path relative to project root.
            content: Content to write.

        Returns:
            Success message with line count, or an error message.
        """
        try:
            file_path = safe_path(path)
            p = Path(file_path)
            p.parent.mkdir(parents=True, exist_ok=True)

            existed = p.exists()
            p.write_text(content, encoding="utf-8")

            line_count = content.count("\n") + 1
            action = "Updated" if existed else "Created"
            return f"{action} {path} ({line_count} lines)"
        except Exception as e:
            return f"Error: Failed to write file: {e}"


class FileEditTool(CrewAIBaseTool):
    """Edit a file by replacing an exact text match with new text."""

    name: str = "file-edit"
    description: str = (
        "Edit a file by replacing an exact text match with new text. "
        "The oldText must appear exactly once in the file (unique match required). "
        "Include surrounding context to ensure uniqueness."
    )

    def _run(self, path: str, oldText: str, newText: str) -> str:
        """
        Replace a unique text occurrence in a file.

        Args:
            path: File path relative to project root.
            oldText: Exact text to find (must be unique in the file).
            newText: Replacement text.

        Returns:
            Success message, or an error if text not found or not unique.
        """
        try:
            file_path = safe_path(path)
            p = Path(file_path)
            if not p.exists():
                return f"Error: File not found: {path}"

            content = p.read_text(encoding="utf-8")

            # Count occurrences
            occurrences = content.count(oldText)
            if occurrences == 0:
                return (
                    f"Error: Text not found in {path}. "
                    "Make sure the oldText matches exactly (including whitespace)."
                )
            if occurrences > 1:
                return (
                    f"Error: Found {occurrences} occurrences in {path}. "
                    "The oldText must be unique. Include more surrounding context."
                )

            updated = content.replace(oldText, newText, 1)
            p.write_text(updated, encoding="utf-8")
            return f"Edited {path}: replaced 1 occurrence"
        except Exception as e:
            return f"Error: Failed to edit file: {e}"


class FileDeleteTool(CrewAIBaseTool):
    """Delete a file."""

    name: str = "file-delete"
    description: str = "Delete a file. Cannot delete directories."

    def _run(self, path: str) -> str:
        """
        Delete a file.

        Args:
            path: File path relative to project root.

        Returns:
            Success message, or an error if file not found or is a directory.
        """
        try:
            file_path = safe_path(path)
            p = Path(file_path)
            if not p.exists():
                return f"Error: File not found: {path}"
            if p.is_dir():
                return f"Error: Path is a directory: {path}. Use shell-exec for directory removal."

            p.unlink()
            return f"Deleted {path}"
        except Exception as e:
            return f"Error: Failed to delete file: {e}"


class FileSearchTool(CrewAIBaseTool):
    """Search for a text pattern in files using grep/ripgrep."""

    name: str = "file-search"
    description: str = (
        "Search for a text pattern in files using grep. Returns matching lines "
        "with file paths and line numbers. Supports regex patterns."
    )

    def _run(
        self,
        pattern: str,
        path: str = ".",
        glob: str | None = None,
    ) -> str:
        """
        Search file contents for a pattern.

        Args:
            pattern: Search pattern (regex supported).
            path: Directory or file to search in (relative to project root).
            glob: File glob pattern to filter (e.g., "*.py").

        Returns:
            Matching lines with file paths and line numbers.
        """
        try:
            search_path = safe_path(path)
            root = get_project_root()

            # Escape single quotes in pattern for shell
            escaped_pattern = pattern.replace("'", "'\\''")

            # Try ripgrep first, fall back to grep
            try:
                subprocess.run(
                    ["which", "rg"], capture_output=True, check=True
                )
                use_rg = True
            except subprocess.CalledProcessError:
                use_rg = False

            if use_rg:
                cmd = [
                    "rg", "--no-heading", "--line-number",
                    "--max-count", "100", "--max-columns", "200",
                ]
                if glob:
                    cmd.extend(["--glob", glob])
                cmd.extend(["--", pattern, search_path])
            else:
                cmd = ["grep", "-rn", "--max-count=100"]
                if glob:
                    cmd.extend([f"--include={glob}"])
                cmd.extend(["--", pattern, search_path])

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=15,
                cwd=root,
            )

            output = result.stdout.strip()
            if not output:
                return "No matches found."

            # Relativize paths
            relativized = output.replace(root + "/", "")
            match_count = len(relativized.split("\n"))
            return f"{relativized}\n\n({match_count} matches)"

        except subprocess.TimeoutExpired:
            return "Error: Search timed out after 15 seconds."
        except Exception as e:
            return f"Error: Search failed: {e}"


class FileGlobTool(CrewAIBaseTool):
    """Find files matching a glob pattern."""

    name: str = "file-glob"
    description: str = (
        "Find files matching a glob pattern. Returns a list of matching file paths. "
        'Example patterns: "**/*.py", "src/**/*.test.ts"'
    )

    def _run(self, pattern: str, path: str = ".") -> str:
        """
        Find files matching a glob pattern.

        Args:
            pattern: Glob pattern (e.g., "**/*.py").
            path: Base directory to search from (relative to project root).

        Returns:
            Newline-separated list of matching file paths.
        """
        try:
            base_path = Path(safe_path(path))
            root = get_project_root()

            # Use pathlib glob
            matches: list[str] = []
            skip_dirs = {".git", "node_modules", "dist", "__pycache__", ".venv", "venv"}

            for match in base_path.rglob("*"):
                # Skip hidden and excluded directories
                parts = match.parts
                if any(part in skip_dirs or part.startswith(".") for part in parts):
                    continue
                if match.is_file() and fnmatch.fnmatch(match.name, pattern.split("/")[-1]):
                    rel = str(match).replace(root + "/", "")
                    matches.append(rel)

            # Also try direct glob if the pattern has directory components
            if "/" in pattern or "**" in pattern:
                matches = []
                for match in base_path.glob(pattern):
                    parts = match.parts
                    if any(part in skip_dirs or part.startswith(".") for part in parts):
                        continue
                    if match.is_file():
                        rel = str(match).replace(root + "/", "")
                        matches.append(rel)

            matches.sort()
            if not matches:
                return "No files found matching the pattern."

            return "\n".join(matches) + f"\n\n({len(matches)} files)"
        except Exception as e:
            return f"Error: Glob failed: {e}"


class FileListTool(CrewAIBaseTool):
    """List the contents of a directory."""

    name: str = "file-list"
    description: str = (
        "List the contents of a directory. Shows files and subdirectories "
        "with type indicators (d=directory, f=file)."
    )

    def _run(self, path: str, recursive: bool = False) -> str:
        """
        List directory contents.

        Args:
            path: Directory path relative to project root.
            recursive: If True, list recursively.

        Returns:
            Directory listing with type prefixes (d/f).
        """
        try:
            dir_path = Path(safe_path(path))
            if not dir_path.exists():
                return f"Error: Directory not found: {path}"
            if not dir_path.is_dir():
                return f"Error: Path is a file, not a directory: {path}"

            root = get_project_root()
            skip_dirs = {".git", "node_modules", "dist", "__pycache__", ".venv"}
            entries: list[str] = []

            def _list(d: Path, depth: int = 0) -> None:
                try:
                    items = sorted(d.iterdir(), key=lambda x: (not x.is_dir(), x.name))
                except PermissionError:
                    return

                for item in items:
                    if item.name.startswith(".") or item.name in skip_dirs:
                        continue
                    rel = str(item).replace(root + "/", "")
                    prefix = "d" if item.is_dir() else "f"
                    entries.append(f"{prefix} {rel}")
                    if recursive and item.is_dir():
                        _list(item, depth + 1)

            _list(dir_path)

            if not entries:
                return "Directory is empty."

            return "\n".join(entries) + f"\n\n({len(entries)} entries)"
        except Exception as e:
            return f"Error: Failed to list directory: {e}"
