"""
File browsing and upload API routes.

Provides endpoints for listing directory contents, reading files,
and uploading files. All paths are validated against the project root
to prevent path traversal attacks.
"""

from __future__ import annotations

import os
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, UploadFile, File as FastAPIFile, Query

from haan.config import settings
from haan.utils.logger import logger

router = APIRouter(prefix="/api/files", tags=["files"])


def _safe_resolve(path_str: str) -> Path:
    """Resolve a path safely within the project root."""
    root = settings.project_root_path
    resolved = (root / path_str).resolve()
    if not str(resolved).startswith(str(root)):
        raise HTTPException(status_code=403, detail="Path traversal not allowed")
    return resolved


@router.get("")
async def list_directory(path: str = Query(default=".", description="Relative path to list")) -> dict[str, Any]:
    """List directory contents with file metadata."""
    target = _safe_resolve(path)
    if not target.is_dir():
        raise HTTPException(status_code=404, detail=f"Directory not found: {path}")

    entries = []
    try:
        for item in sorted(target.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower())):
            # Skip hidden files and common ignore patterns
            if item.name.startswith('.') or item.name in ('__pycache__', 'node_modules', '.git', 'dist', 'build'):
                continue
            stat = item.stat()
            entries.append({
                "name": item.name,
                "type": "directory" if item.is_dir() else "file",
                "size": stat.st_size if item.is_file() else None,
                "modified": stat.st_mtime,
                "path": str(item.relative_to(settings.project_root_path)),
            })
    except PermissionError:
        raise HTTPException(status_code=403, detail="Permission denied")

    return {"path": path, "entries": entries, "count": len(entries)}


@router.get("/read")
async def read_file(path: str = Query(..., description="Relative path to read")) -> dict[str, Any]:
    """Read file content with syntax type detection."""
    target = _safe_resolve(path)
    if not target.is_file():
        raise HTTPException(status_code=404, detail=f"File not found: {path}")

    # Detect syntax type from extension
    ext_map = {
        '.py': 'python', '.js': 'javascript', '.ts': 'typescript',
        '.tsx': 'typescriptreact', '.jsx': 'javascriptreact',
        '.json': 'json', '.md': 'markdown', '.css': 'css',
        '.html': 'html', '.yaml': 'yaml', '.yml': 'yaml',
        '.toml': 'toml', '.rs': 'rust', '.go': 'go',
        '.sh': 'shell', '.bash': 'shell', '.sql': 'sql',
    }
    syntax = ext_map.get(target.suffix.lower(), 'text')

    try:
        content = target.read_text(encoding='utf-8', errors='replace')
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read file: {e}")

    # Truncate very large files
    max_size = 500_000
    truncated = len(content) > max_size
    if truncated:
        content = content[:max_size]

    return {
        "path": path,
        "content": content,
        "syntax": syntax,
        "size": target.stat().st_size,
        "truncated": truncated,
    }


@router.post("/upload")
async def upload_file(file: UploadFile = FastAPIFile(...)) -> dict[str, str]:
    """Upload a file to the project's .haan/uploads directory."""
    upload_dir = settings.project_root_path / ".haan" / "uploads"
    upload_dir.mkdir(parents=True, exist_ok=True)

    safe_name = f"{uuid.uuid4().hex[:8]}_{file.filename}"
    dest = upload_dir / safe_name

    try:
        content = await file.read()
        dest.write_bytes(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {e}")

    logger.info("files", f"File uploaded: {safe_name} ({len(content)} bytes)")
    return {"path": str(dest.relative_to(settings.project_root_path)), "name": safe_name}
