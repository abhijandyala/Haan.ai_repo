"""
Pydantic request/response models for the Haan.ai API.

Defines the data contracts for all REST API endpoints, ensuring
type-safe request validation and consistent response formats.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


# ── Health & Status ──

class HealthResponse(BaseModel):
    """Response model for GET /api/health."""

    status: str = "ok"
    version: str


class StatusResponse(BaseModel):
    """Response model for GET /api/status."""

    pipeline_stage: str
    task: str | None = None
    mode: str | None = None
    retry_count: int = 0
    cost: dict[str, Any] = Field(default_factory=dict)
    connected_clients: int = 0


# ── Tools ──

class ToolSchema(BaseModel):
    """Schema for a single tool in the registry."""

    name: str
    description: str


class ToolListResponse(BaseModel):
    """Response model for GET /api/tools."""

    tools: list[ToolSchema]
    count: int


# ── Pipeline ──

class PipelineStartRequest(BaseModel):
    """Request model for POST /api/pipeline/start."""

    task: str = Field(..., min_length=1, description="Natural language task description")
    mode: Literal["auto", "human"] = Field(
        default="auto",
        description="Execution mode: 'auto' for fully automatic, 'human' for approval gates",
    )
    stages: list[str] | None = Field(
        default=None,
        description="Optional subset of stages to run (planning, building, testing, reviewing)",
    )
    model: str | None = Field(
        default=None,
        description="Optional model override (e.g., 'claude-sonnet-4-20250514')",
    )
    provider: str | None = Field(
        default=None,
        description="Optional provider override (anthropic, openai, google)",
    )


class PipelineStartResponse(BaseModel):
    """Response model for POST /api/pipeline/start."""

    status: str = "started"
    task: str
    mode: str


class PipelineStateResponse(BaseModel):
    """Response model for GET /api/pipeline/state."""

    current_stage: str
    task: str
    mode: str
    retry_count: int
    improvement_pass: int
    outputs: dict[str, Any]
    error: str | None = None


class ApprovalRequest(BaseModel):
    """Request model for POST /api/pipeline/approve."""

    stage: str = Field(..., description="Stage to approve or reject")
    approved: bool = Field(..., description="Whether to approve the stage")


# ── Threads ──

class ThreadCreateRequest(BaseModel):
    """Request model for POST /api/threads."""

    title: str = Field(default="New Thread", min_length=1)
    task: str | None = None


class ThreadMessage(BaseModel):
    """A single message within a thread."""

    role: Literal["user", "assistant", "system"]
    content: str
    agent: str | None = None
    timestamp: float


class ThreadResponse(BaseModel):
    """Response model for a single thread."""

    id: str
    title: str
    status: Literal["idle", "running", "completed", "failed"]
    created_at: float
    updated_at: float
    messages: list[ThreadMessage] = Field(default_factory=list)
    file_changes: int = 0


class ThreadListResponse(BaseModel):
    """Response model for GET /api/threads."""

    threads: list[ThreadResponse]
    count: int


# ── Models ──

class ModelInfo(BaseModel):
    """Information about an available LLM model."""

    provider: str
    model: str
    available: bool


class ModelListResponse(BaseModel):
    """Response model for GET /api/models."""

    models: list[ModelInfo]
    default_provider: str
    default_model: str


# ── Files ──

class FileEntry(BaseModel):
    """A single file or directory entry."""
    name: str
    type: Literal["file", "directory"]
    size: int | None = None
    modified: float
    path: str


class FileListResponse(BaseModel):
    """Response for GET /api/files."""
    path: str
    entries: list[FileEntry]
    count: int


class FileContentResponse(BaseModel):
    """Response for GET /api/files/read."""
    path: str
    content: str
    syntax: str
    size: int
    truncated: bool = False


# ── Git ──

class GitFileChange(BaseModel):
    """A changed file in git status."""
    status: str
    path: str


class GitStatusResponse(BaseModel):
    """Response for GET /api/git/status."""
    available: bool = False
    branch: str | None = None
    changed_files: list[GitFileChange] = Field(default_factory=list)
    changes_count: int = 0
    ahead: int = 0
    behind: int = 0


# ── Cancel ──

class CancelResponse(BaseModel):
    """Response for POST /api/pipeline/cancel."""
    status: str = "cancelled"
