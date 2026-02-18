"""
Pipeline data types and models.

Defines the core data structures used throughout the pipeline:
- PipelineStage enum for stage names
- StageOutput for individual stage results
- PipelineState for tracking the overall pipeline execution
- StageDependency for DAG edge definitions
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Literal


class PipelineStage(str, Enum):
    """
    All stages in the Haan.ai software engineering pipeline.

    The pipeline progresses through these stages, with some stages
    potentially repeating in retry/improvement loops.
    """

    IDLE = "idle"
    PLANNING = "planning"
    BUILDING = "building"
    TESTING = "testing"
    DEBUGGING = "debugging"
    REVIEWING = "reviewing"
    COMPLETE = "complete"
    FAILED = "failed"


@dataclass
class StageOutput:
    """
    Output from a single pipeline stage execution.

    Captures the result content, success status, timing information,
    token usage, and any structured data the agent produced.
    """

    stage: PipelineStage
    success: bool
    content: str
    duration: int  # milliseconds
    tokens_used: dict[str, int] = field(default_factory=lambda: {"input": 0, "output": 0})
    structured: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        """Serialize to a JSON-compatible dictionary."""
        return {
            "stage": self.stage.value,
            "success": self.success,
            "content": self.content,
            "duration": self.duration,
            "tokens_used": self.tokens_used,
            "structured": self.structured,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> StageOutput:
        """Deserialize from a dictionary."""
        return cls(
            stage=PipelineStage(data["stage"]),
            success=data["success"],
            content=data["content"],
            duration=data["duration"],
            tokens_used=data.get("tokens_used", {"input": 0, "output": 0}),
            structured=data.get("structured"),
        )


@dataclass
class PipelineState:
    """
    Current state of the pipeline execution.

    Tracks the active stage, accumulated outputs, retry counts,
    improvement passes, and timing information.
    """

    current_stage: PipelineStage
    task: str
    mode: Literal["auto", "human"] = "auto"
    outputs: dict[PipelineStage, StageOutput] = field(default_factory=dict)
    retry_count: int = 0
    max_retries: int = 3
    improvement_pass: int = 0
    max_improvement_passes: int = 2
    start_time: float = 0.0
    error: str | None = None
    cancelled: bool = False

    def to_dict(self) -> dict[str, Any]:
        """Serialize to a JSON-compatible dictionary."""
        return {
            "current_stage": self.current_stage.value,
            "task": self.task,
            "mode": self.mode,
            "outputs": {k.value: v.to_dict() for k, v in self.outputs.items()},
            "retry_count": self.retry_count,
            "max_retries": self.max_retries,
            "improvement_pass": self.improvement_pass,
            "max_improvement_passes": self.max_improvement_passes,
            "start_time": self.start_time,
            "error": self.error,
            "cancelled": self.cancelled,
        }


@dataclass
class StageDependency:
    """
    A DAG edge defining stage execution order.

    A stage can only execute after all its dependencies have completed.
    """

    stage: PipelineStage
    depends_on: list[PipelineStage] = field(default_factory=list)


# ── Default Pipeline Configuration ──

DEFAULT_PIPELINE_STAGES: list[PipelineStage] = [
    PipelineStage.PLANNING,
    PipelineStage.BUILDING,
    PipelineStage.TESTING,
    PipelineStage.REVIEWING,
]

DEFAULT_PIPELINE_DAG: list[StageDependency] = [
    StageDependency(stage=PipelineStage.PLANNING, depends_on=[]),
    StageDependency(stage=PipelineStage.BUILDING, depends_on=[PipelineStage.PLANNING]),
    StageDependency(stage=PipelineStage.TESTING, depends_on=[PipelineStage.BUILDING]),
    StageDependency(stage=PipelineStage.REVIEWING, depends_on=[PipelineStage.TESTING]),
]
