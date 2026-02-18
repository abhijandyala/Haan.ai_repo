"""
Memory manager for the Haan.ai backend.

Provides two tiers of memory:
1. Working memory: In-process dict for the current pipeline run (fast, ephemeral)
2. Long-term memory: SQLite database for persistent knowledge across sessions

The memory manager is used by agents to store and retrieve context,
decisions, and insights during pipeline execution.
"""

from __future__ import annotations

import json
import sqlite3
import time
from pathlib import Path
from typing import Any

from haan.utils.logger import logger
from haan.utils.path_utils import haan_sub_dir


class MemoryManager:
    """
    Two-tier memory system for Haan.ai agents.

    Working memory is a simple dict that lives for the duration of a pipeline run.
    Long-term memory is backed by SQLite for persistence across sessions.
    """

    def __init__(self, project_root: str | None = None) -> None:
        """
        Initialize the memory manager.

        Args:
            project_root: Project root path. If None, uses the default from path_utils.
        """
        self._working: dict[str, Any] = {}
        self._db_path = Path(haan_sub_dir("memory")) / "long_term.db"
        self._init_db()

    def _init_db(self) -> None:
        """Initialize the SQLite database schema if it doesn't exist."""
        try:
            with sqlite3.connect(str(self._db_path)) as conn:
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS memories (
                        key TEXT PRIMARY KEY,
                        content TEXT NOT NULL,
                        tags TEXT DEFAULT '[]',
                        created_at REAL NOT NULL,
                        updated_at REAL NOT NULL
                    )
                """)
                conn.execute("""
                    CREATE INDEX IF NOT EXISTS idx_memories_tags ON memories(tags)
                """)
                conn.commit()
            logger.debug("memory", f"SQLite memory initialized: {self._db_path}")
        except Exception as e:
            logger.error("memory", f"Failed to initialize SQLite: {e}")

    # ═══════════════════════════════════════════════
    # Working Memory (In-Process Dict)
    # ═══════════════════════════════════════════════

    def set_working(self, key: str, value: Any) -> None:
        """
        Store a value in working memory.

        Args:
            key: Storage key.
            value: Any serializable value.
        """
        self._working[key] = value

    def get_working(self, key: str, default: Any = None) -> Any:
        """
        Retrieve a value from working memory.

        Args:
            key: Storage key.
            default: Value to return if key is not found.

        Returns:
            The stored value, or default if not found.
        """
        return self._working.get(key, default)

    def clear_working(self) -> None:
        """Clear all working memory (called at start of each pipeline run)."""
        self._working.clear()
        logger.debug("memory", "Working memory cleared")

    # ═══════════════════════════════════════════════
    # Long-Term Memory (SQLite)
    # ═══════════════════════════════════════════════

    def save(self, key: str, content: str, tags: list[str] | None = None) -> None:
        """
        Save or update a long-term memory entry.

        Args:
            key: Unique memory key.
            content: Memory content string.
            tags: Optional list of tags for categorization.
        """
        now = time.time()
        tags_json = json.dumps(tags or [])

        try:
            with sqlite3.connect(str(self._db_path)) as conn:
                conn.execute("""
                    INSERT INTO memories (key, content, tags, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT(key) DO UPDATE SET
                        content = excluded.content,
                        tags = excluded.tags,
                        updated_at = excluded.updated_at
                """, (key, content, tags_json, now, now))
                conn.commit()

            logger.debug("memory", f"Saved long-term memory: {key}")
        except Exception as e:
            logger.error("memory", f"Failed to save memory '{key}': {e}")

    def load(self, key: str) -> dict[str, Any] | None:
        """
        Load a long-term memory entry by key.

        Args:
            key: Memory key to retrieve.

        Returns:
            Dict with key, content, tags, created_at, updated_at, or None if not found.
        """
        try:
            with sqlite3.connect(str(self._db_path)) as conn:
                row = conn.execute(
                    "SELECT key, content, tags, created_at, updated_at FROM memories WHERE key = ?",
                    (key,),
                ).fetchone()

            if row is None:
                return None

            return {
                "key": row[0],
                "content": row[1],
                "tags": json.loads(row[2]),
                "created_at": row[3],
                "updated_at": row[4],
            }
        except Exception as e:
            logger.error("memory", f"Failed to load memory '{key}': {e}")
            return None

    def search(self, query: str, limit: int = 20) -> list[dict[str, Any]]:
        """
        Search long-term memories by keyword.

        Searches across keys, content, and tags using SQLite LIKE.

        Args:
            query: Search query string.
            limit: Maximum number of results.

        Returns:
            List of matching memory entry dicts.
        """
        try:
            pattern = f"%{query}%"
            with sqlite3.connect(str(self._db_path)) as conn:
                rows = conn.execute("""
                    SELECT key, content, tags, created_at, updated_at
                    FROM memories
                    WHERE key LIKE ? OR content LIKE ? OR tags LIKE ?
                    ORDER BY updated_at DESC
                    LIMIT ?
                """, (pattern, pattern, pattern, limit)).fetchall()

            return [
                {
                    "key": row[0],
                    "content": row[1],
                    "tags": json.loads(row[2]),
                    "created_at": row[3],
                    "updated_at": row[4],
                }
                for row in rows
            ]
        except Exception as e:
            logger.error("memory", f"Memory search failed: {e}")
            return []

    def delete(self, key: str) -> bool:
        """
        Delete a long-term memory entry.

        Args:
            key: Memory key to delete.

        Returns:
            True if the entry was found and deleted, False otherwise.
        """
        try:
            with sqlite3.connect(str(self._db_path)) as conn:
                cursor = conn.execute("DELETE FROM memories WHERE key = ?", (key,))
                conn.commit()
                return cursor.rowcount > 0
        except Exception as e:
            logger.error("memory", f"Failed to delete memory '{key}': {e}")
            return False

    def list_keys(self) -> list[str]:
        """Return all memory keys."""
        try:
            with sqlite3.connect(str(self._db_path)) as conn:
                rows = conn.execute("SELECT key FROM memories ORDER BY key").fetchall()
            return [row[0] for row in rows]
        except Exception as e:
            logger.error("memory", f"Failed to list memory keys: {e}")
            return []
