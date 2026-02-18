"""
FastAPI server for the Haan.ai backend.

Provides REST API routes for:
- Health check and status monitoring
- Tool registry inspection
- Pipeline execution and control
- Thread management
- Model listing
- Static file serving for the dashboard

The server also hosts the WebSocket endpoint via the websocket module.
"""

from __future__ import annotations

import subprocess
import time
import uuid
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from haan import __version__
from haan.api.models import (
    ApprovalRequest,
    HealthResponse,
    ModelInfo,
    ModelListResponse,
    PipelineStartRequest,
    PipelineStartResponse,
    PipelineStateResponse,
    StatusResponse,
    ThreadCreateRequest,
    ThreadListResponse,
    ThreadMessage,
    ThreadResponse,
    ToolListResponse,
    ToolSchema,
)
from haan.api.files import router as files_router
from haan.api.websocket import ws_manager
from haan.config import settings
from haan.pipeline.engine import PipelineEngine
from haan.pipeline.types import PipelineStage
from haan.providers.factory import list_available_models
from haan.tools import get_all_tool_schemas
from haan.utils.cost_tracker import cost_tracker
from haan.utils.logger import logger

# ── FastAPI Application ──

app = FastAPI(
    title="Haan.ai",
    description="AI-powered software engineering pipeline",
    version=__version__,
)

# CORS middleware — allow the dashboard dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(files_router)

# ── State ──
# In-memory thread storage (in production, use a database)
_threads: dict[str, dict[str, Any]] = {}
_pipeline_engine: PipelineEngine | None = None


@app.on_event("startup")
async def _startup() -> None:
    """Initialize the pipeline engine on server startup so WebSocket has it ready."""
    _get_engine()


def _get_engine() -> PipelineEngine:
    """Get or create the global pipeline engine singleton."""
    global _pipeline_engine
    if _pipeline_engine is None:
        _pipeline_engine = PipelineEngine()
        ws_manager.set_pipeline(_pipeline_engine)
    return _pipeline_engine


# ═══════════════════════════════════════════════════
# WebSocket
# ═══════════════════════════════════════════════════


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    """WebSocket endpoint for real-time event streaming to the dashboard."""
    await ws_manager.connect(websocket)


# ═══════════════════════════════════════════════════
# Health & Status
# ═══════════════════════════════════════════════════


@app.get("/api/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Health check endpoint. Returns 200 if the server is running."""
    return HealthResponse(status="ok", version=__version__)


@app.get("/api/status", response_model=StatusResponse)
async def status() -> StatusResponse:
    """Return current pipeline status, cost tracking, and connection info."""
    engine = _get_engine()
    state = engine.state
    return StatusResponse(
        pipeline_stage=state.current_stage.value,
        task=state.task or None,
        mode=state.mode,
        retry_count=state.retry_count,
        cost=cost_tracker.get_task_summary(),
        connected_clients=0,  # Updated by WebSocket handler
    )


# ═══════════════════════════════════════════════════
# Tools
# ═══════════════════════════════════════════════════


@app.get("/api/tools", response_model=ToolListResponse)
async def list_tools() -> ToolListResponse:
    """Return the list of all registered tools with their descriptions."""
    schemas = get_all_tool_schemas()
    tools = [ToolSchema(name=s["name"], description=s["description"]) for s in schemas]
    return ToolListResponse(tools=tools, count=len(tools))


# ═══════════════════════════════════════════════════
# Pipeline
# ═══════════════════════════════════════════════════


@app.post("/api/pipeline/start", response_model=PipelineStartResponse)
async def start_pipeline(request: PipelineStartRequest) -> PipelineStartResponse:
    """
    Start a new pipeline execution.

    Runs asynchronously — use WebSocket or GET /api/pipeline/state to track progress.
    """
    engine = _get_engine()

    # Validate the current state (don't start if already running)
    if engine.state.current_stage not in (
        PipelineStage.IDLE,
        PipelineStage.COMPLETE,
        PipelineStage.FAILED,
    ):
        raise HTTPException(
            status_code=409,
            detail=f"Pipeline is already running (stage: {engine.state.current_stage.value})",
        )

    # Parse stages if provided
    stages = None
    if request.stages:
        try:
            stages = [PipelineStage(s) for s in request.stages]
        except ValueError as e:
            raise HTTPException(status_code=400, detail=f"Invalid stage: {e}")

    # Start pipeline in background
    import asyncio

    asyncio.create_task(
        engine.execute(
            task=request.task,
            mode=request.mode,
            stages=stages,
        )
    )

    logger.info("api", f"Pipeline started: {request.task}")
    return PipelineStartResponse(
        status="started",
        task=request.task,
        mode=request.mode,
    )


@app.get("/api/pipeline/state", response_model=PipelineStateResponse)
async def get_pipeline_state() -> PipelineStateResponse:
    """Return the current pipeline state."""
    engine = _get_engine()
    state = engine.state
    return PipelineStateResponse(
        current_stage=state.current_stage.value,
        task=state.task,
        mode=state.mode,
        retry_count=state.retry_count,
        improvement_pass=state.improvement_pass,
        outputs={
            stage.value: output.to_dict()
            for stage, output in state.outputs.items()
        },
        error=state.error,
    )


@app.post("/api/pipeline/approve")
async def approve_stage(request: ApprovalRequest) -> dict[str, str]:
    """Approve or reject a stage in human-aided mode."""
    engine = _get_engine()
    engine.approve_stage(request.stage, request.approved)
    action = "approved" if request.approved else "rejected"
    return {"status": f"Stage '{request.stage}' {action}"}


@app.post("/api/pipeline/cancel")
async def cancel_pipeline() -> dict[str, str]:
    """Cancel the currently running pipeline."""
    engine = _get_engine()
    engine.cancel()
    return {"status": "cancelled"}


# ═══════════════════════════════════════════════════
# Threads
# ═══════════════════════════════════════════════════


@app.get("/api/threads", response_model=ThreadListResponse)
async def list_threads() -> ThreadListResponse:
    """List all threads, sorted by most recently updated."""
    threads = sorted(
        _threads.values(),
        key=lambda t: t["updated_at"],
        reverse=True,
    )
    responses = [_thread_to_response(t) for t in threads]
    return ThreadListResponse(threads=responses, count=len(responses))


@app.post("/api/threads", response_model=ThreadResponse)
async def create_thread(request: ThreadCreateRequest) -> ThreadResponse:
    """Create a new thread."""
    thread_id = str(uuid.uuid4())
    now = time.time()

    thread = {
        "id": thread_id,
        "title": request.title,
        "status": "idle",
        "created_at": now,
        "updated_at": now,
        "messages": [],
        "file_changes": 0,
    }
    _threads[thread_id] = thread

    logger.info("api", f"Thread created: {thread_id} ({request.title})")
    return _thread_to_response(thread)


@app.get("/api/threads/{thread_id}", response_model=ThreadResponse)
async def get_thread(thread_id: str) -> ThreadResponse:
    """Get a thread by ID with its messages."""
    thread = _threads.get(thread_id)
    if not thread:
        raise HTTPException(status_code=404, detail=f"Thread not found: {thread_id}")
    return _thread_to_response(thread)


def _thread_to_response(thread: dict[str, Any]) -> ThreadResponse:
    """Convert internal thread dict to API response model."""
    messages = [
        ThreadMessage(
            role=m["role"],
            content=m["content"],
            agent=m.get("agent"),
            timestamp=m["timestamp"],
        )
        for m in thread.get("messages", [])
    ]
    return ThreadResponse(
        id=thread["id"],
        title=thread["title"],
        status=thread["status"],
        created_at=thread["created_at"],
        updated_at=thread["updated_at"],
        messages=messages,
        file_changes=thread.get("file_changes", 0),
    )


# ═══════════════════════════════════════════════════
# Models
# ═══════════════════════════════════════════════════


@app.get("/api/models", response_model=ModelListResponse)
async def list_models() -> ModelListResponse:
    """List all available LLM models and their availability status."""
    models = list_available_models()
    return ModelListResponse(
        models=[ModelInfo(**m) for m in models],
        default_provider=settings.default_provider,
        default_model=settings.default_model,
    )


# ═══════════════════════════════════════════════════
# Git
# ═══════════════════════════════════════════════════


@app.get("/api/git/status")
async def git_status() -> dict[str, Any]:
    """Return current git status information."""
    project_root = str(settings.project_root_path)
    result: dict[str, Any] = {"available": False}

    try:
        # Current branch
        branch = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True, text=True, cwd=project_root, timeout=5,
        )
        if branch.returncode != 0:
            return result

        result["available"] = True
        result["branch"] = branch.stdout.strip()

        # Changed files
        status = subprocess.run(
            ["git", "status", "--porcelain"],
            capture_output=True, text=True, cwd=project_root, timeout=5,
        )
        changed_files = []
        for line in status.stdout.strip().split('\n'):
            if line.strip():
                status_code = line[:2].strip()
                filepath = line[3:]
                changed_files.append({"status": status_code, "path": filepath})
        result["changed_files"] = changed_files
        result["changes_count"] = len(changed_files)

        # Ahead/behind
        try:
            ahead_behind = subprocess.run(
                ["git", "rev-list", "--left-right", "--count", "HEAD...@{upstream}"],
                capture_output=True, text=True, cwd=project_root, timeout=5,
            )
            if ahead_behind.returncode == 0:
                parts = ahead_behind.stdout.strip().split('\t')
                result["ahead"] = int(parts[0])
                result["behind"] = int(parts[1])
        except Exception:
            pass

    except Exception:
        pass

    return result


# ═══════════════════════════════════════════════════
# Settings
# ═══════════════════════════════════════════════════


@app.get("/api/settings")
async def get_settings() -> dict[str, Any]:
    """Return current settings with API keys masked."""
    def mask_key(key: str) -> str:
        if not key or len(key) < 8:
            return key
        return key[:4] + "..." + key[-4:]

    return {
        "anthropic_api_key": mask_key(settings.anthropic_api_key),
        "openai_api_key": mask_key(settings.openai_api_key),
        "google_api_key": mask_key(settings.google_api_key),
        "default_provider": settings.default_provider,
        "default_model": settings.default_model,
        "max_retries": settings.max_retries,
        "budget_per_task": settings.budget_per_task,
    }


@app.post("/api/settings")
async def update_settings(body: dict[str, Any]) -> dict[str, str]:
    """Update settings and write to .env file."""
    env_path = settings.project_root_path / ".env"

    # Read existing .env content
    existing: dict[str, str] = {}
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                existing[k.strip()] = v.strip()

    # Map settings fields to env var names
    field_to_env = {
        "anthropic_api_key": "ANTHROPIC_API_KEY",
        "openai_api_key": "OPENAI_API_KEY",
        "google_api_key": "GOOGLE_API_KEY",
        "default_provider": "HAAN_DEFAULT_PROVIDER",
        "default_model": "HAAN_DEFAULT_MODEL",
        "max_retries": "HAAN_MAX_RETRIES",
        "budget_per_task": "HAAN_BUDGET_PER_TASK",
    }

    for field, env_var in field_to_env.items():
        if field in body:
            value = str(body[field])
            # Don't overwrite with masked values
            if "..." not in value:
                existing[env_var] = value

    # Write back
    lines = [f"{k}={v}" for k, v in existing.items()]
    env_path.write_text("\n".join(lines) + "\n")

    # Also update the in-memory settings singleton so changes take effect immediately
    field_to_attr = {
        "anthropic_api_key": "anthropic_api_key",
        "openai_api_key": "openai_api_key",
        "google_api_key": "google_api_key",
        "default_provider": "default_provider",
        "default_model": "default_model",
        "max_retries": "max_retries",
        "budget_per_task": "budget_per_task",
    }
    for field, attr in field_to_attr.items():
        if field in body:
            value = body[field]
            if isinstance(value, str) and "..." in value:
                continue
            object.__setattr__(settings, attr, value)

    logger.info("api", "Settings updated")
    return {"status": "saved"}


# ═══════════════════════════════════════════════════
# Static Files (Dashboard)
# ═══════════════════════════════════════════════════

# Serve the built dashboard if it exists
_dashboard_dist = Path(__file__).resolve().parent.parent.parent.parent.parent / "dashboard" / "dist"
if _dashboard_dist.is_dir():
    app.mount("/", StaticFiles(directory=str(_dashboard_dist), html=True), name="dashboard")
