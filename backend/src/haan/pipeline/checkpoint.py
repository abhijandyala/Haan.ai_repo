"""
Pipeline checkpoint save/restore for crash recovery.

Checkpoints are saved as JSON files in the .haan/checkpoints/ directory
after each stage completes. If the pipeline crashes, it can resume from
the last checkpoint instead of re-running completed stages.
"""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Any

from haan.pipeline.types import PipelineStage, PipelineState, StageOutput
from haan.utils.logger import logger
from haan.utils.path_utils import haan_sub_dir


def _checkpoint_dir() -> Path:
    """Return the checkpoint storage directory."""
    return Path(haan_sub_dir("checkpoints"))


def _checkpoint_path(task: str) -> Path:
    """
    Generate a deterministic checkpoint file path for a given task.

    Uses a hash of the task description to create a safe filename.
    """
    # Create a safe filename from the task description
    task_hash = hashlib.sha256(task.encode()).hexdigest()[:12]
    safe_name = re.sub(r"[^a-zA-Z0-9]", "_", task[:50])
    return _checkpoint_dir() / f"{safe_name}_{task_hash}.json"


def save_checkpoint(state: PipelineState) -> str:
    """
    Save the current pipeline state as a checkpoint.

    Args:
        state: The current pipeline state to persist.

    Returns:
        Absolute path to the saved checkpoint file.
    """
    path = _checkpoint_path(state.task)

    # Build serializable checkpoint data
    data = {
        "task": state.task,
        "mode": state.mode,
        "retry_count": state.retry_count,
        "improvement_pass": state.improvement_pass,
        "completed_stages": [
            stage.value
            for stage, output in state.outputs.items()
            if output.success
        ],
        "outputs": {
            stage.value: output.to_dict()
            for stage, output in state.outputs.items()
        },
    }

    path.write_text(json.dumps(data, indent=2), encoding="utf-8")
    logger.info("checkpoint", f"Saved checkpoint: {path.name}")
    return str(path)


def load_checkpoint(path: str) -> dict[str, Any] | None:
    """
    Load a checkpoint from a file path.

    Args:
        path: Path to the checkpoint JSON file.

    Returns:
        Checkpoint data dict, or None if the file doesn't exist or is invalid.
    """
    p = Path(path)
    if not p.exists():
        logger.warn("checkpoint", f"Checkpoint not found: {path}")
        return None

    try:
        data = json.loads(p.read_text(encoding="utf-8"))
        logger.info("checkpoint", f"Loaded checkpoint: {p.name}")
        return data
    except (json.JSONDecodeError, IOError) as e:
        logger.error("checkpoint", f"Failed to load checkpoint: {e}")
        return None


def restore_from_checkpoint(
    data: dict[str, Any],
) -> tuple[list[PipelineStage], dict[PipelineStage, StageOutput]]:
    """
    Restore pipeline state from checkpoint data.

    Args:
        data: Checkpoint data as returned by load_checkpoint().

    Returns:
        Tuple of (completed_stages, stage_outputs) for restoring pipeline state.
    """
    completed_stages = [PipelineStage(s) for s in data.get("completed_stages", [])]

    outputs: dict[PipelineStage, StageOutput] = {}
    for stage_str, output_data in data.get("outputs", {}).items():
        stage = PipelineStage(stage_str)
        outputs[stage] = StageOutput.from_dict(output_data)

    return completed_stages, outputs


def remove_checkpoint(task: str) -> None:
    """
    Remove the checkpoint file for a completed task.

    Args:
        task: The task description used to generate the checkpoint filename.
    """
    path = _checkpoint_path(task)
    if path.exists():
        path.unlink()
        logger.info("checkpoint", f"Removed checkpoint: {path.name}")
