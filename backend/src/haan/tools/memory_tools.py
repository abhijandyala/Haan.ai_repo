"""
Persistent memory tools for Haan.ai agents.

Provides 3 tools mirroring the TypeScript memory-tools.ts:
- MemorySaveTool:   Save key-value information to long-term memory
- MemoryLoadTool:   Load a specific memory entry by key
- MemorySearchTool: Search memories by keyword across keys, content, and tags

Memory is stored as JSON files in the .haan/memory/ directory under the project root.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from crewai.tools import BaseTool as CrewAIBaseTool

from haan.utils.logger import logger
from haan.utils.path_utils import haan_sub_dir


def _get_memory_dir() -> Path:
    """Return the path to the memory storage directory."""
    return Path(haan_sub_dir("memory"))


def _sanitize_key(key: str) -> str:
    """Sanitize a memory key to a safe filename."""
    import re
    return re.sub(r"[^a-zA-Z0-9_-]", "_", key)


def _get_memory_path(key: str) -> Path:
    """Return the file path for a memory entry."""
    return _get_memory_dir() / f"{_sanitize_key(key)}.json"


def _load_entry(path: Path) -> dict[str, Any] | None:
    """Load a memory entry from a JSON file. Returns None on failure."""
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return None


def _load_all_entries() -> list[dict[str, Any]]:
    """Load all memory entries from the memory directory."""
    memory_dir = _get_memory_dir()
    entries: list[dict[str, Any]] = []

    if not memory_dir.exists():
        return entries

    for file in sorted(memory_dir.glob("*.json")):
        entry = _load_entry(file)
        if entry:
            entries.append(entry)

    return entries


class MemorySaveTool(CrewAIBaseTool):
    """Save information to long-term memory."""

    name: str = "memory-save"
    description: str = (
        "Save information to long-term memory. Use this to remember important facts, "
        "decisions, context, or patterns. Specify a unique key and optional tags "
        "for later retrieval."
    )

    def _run(
        self,
        key: str,
        content: str,
        tags: list[str] | None = None,
    ) -> str:
        """
        Save a memory entry.

        Args:
            key: Unique key to identify this memory.
            content: Content to remember.
            tags: Optional tags for categorization and search.

        Returns:
            Success message indicating whether the entry was created or updated.
        """
        try:
            file_path = _get_memory_path(key)
            now = datetime.now(timezone.utc).isoformat()
            tag_list = tags or []

            # Check if entry already exists (for createdAt preservation)
            existing = _load_entry(file_path)

            entry = {
                "key": key,
                "content": content,
                "tags": tag_list,
                "createdAt": existing["createdAt"] if existing else now,
                "updatedAt": now,
            }

            file_path.write_text(json.dumps(entry, indent=2), encoding="utf-8")
            logger.info("memory", f"Saved memory: {key}")

            action = "Updated" if existing else "Saved"
            return f'{action} memory: "{key}" ({len(tag_list)} tags)'
        except Exception as e:
            return f"Error: Failed to save memory: {e}"


class MemoryLoadTool(CrewAIBaseTool):
    """Load a specific memory entry by key."""

    name: str = "memory-load"
    description: str = "Load a specific memory entry by key. Returns the content and metadata."

    def _run(self, key: str) -> str:
        """
        Load a memory entry.

        Args:
            key: Memory key to load.

        Returns:
            Memory content with metadata, or error if not found.
        """
        try:
            file_path = _get_memory_path(key)
            entry = _load_entry(file_path)

            if not entry:
                return f'Error: Memory not found: "{key}"'

            output = [
                f"Key: {entry['key']}",
                f"Tags: {', '.join(entry.get('tags', [])) or 'none'}",
                f"Created: {entry.get('createdAt', 'unknown')}",
                f"Updated: {entry.get('updatedAt', 'unknown')}",
                "",
                entry["content"],
            ]
            return "\n".join(output)
        except Exception as e:
            return f"Error: Failed to load memory: {e}"


class MemorySearchTool(CrewAIBaseTool):
    """Search memories by keyword."""

    name: str = "memory-search"
    description: str = (
        "Search memories by keyword. Searches across keys, content, and tags. "
        "Returns matching entries with content previews."
    )

    def _run(self, query: str) -> str:
        """
        Search memory entries.

        Args:
            query: Search query string.

        Returns:
            Matching memory entries with previews.
        """
        try:
            query_lower = query.lower()
            entries = _load_all_entries()

            matches = [
                e
                for e in entries
                if query_lower
                in " ".join([e["key"], e["content"]] + e.get("tags", [])).lower()
            ]

            if not matches:
                return f'No memories found matching: "{query}"'

            output_parts: list[str] = []
            for entry in matches:
                content = entry["content"]
                preview = content[:100] + "..." if len(content) > 100 else content
                tags = ", ".join(entry.get("tags", [])) or "none"
                output_parts.append(f"[{entry['key']}] (tags: {tags})\n  {preview}")

            return "\n\n".join(output_parts) + f"\n\n({len(matches)} matches)"
        except Exception as e:
            return f"Error: Memory search failed: {e}"
