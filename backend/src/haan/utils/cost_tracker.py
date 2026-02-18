"""
Token usage and cost tracking for the Haan.ai backend.

Tracks per-task and daily token usage and estimated costs across all
LLM providers. Supports budget limits that raise BudgetExceededError
when exceeded, allowing the pipeline to stop gracefully.

Usage:
    from haan.utils.cost_tracker import cost_tracker

    cost_tracker.set_budget(per_task=5.0, daily=50.0)
    cost_tracker.add_usage("claude-sonnet-4-20250514", input_tokens=1000, output_tokens=500)
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any


class BudgetExceededError(Exception):
    """Raised when a budget limit (per-task or daily) is exceeded."""

    pass


# Approximate cost per 1M tokens (USD) for common models
# These are rough estimates used for budget tracking, not billing.
MODEL_COSTS: dict[str, dict[str, float]] = {
    # Anthropic
    "claude-sonnet-4-20250514": {"input": 3.0, "output": 15.0},
    "claude-opus-4-20250514": {"input": 15.0, "output": 75.0},
    "claude-haiku-3-20250306": {"input": 0.25, "output": 1.25},
    # OpenAI
    "gpt-4o": {"input": 2.5, "output": 10.0},
    "gpt-4o-mini": {"input": 0.15, "output": 0.6},
    "o3-mini": {"input": 1.1, "output": 4.4},
    # Google
    "gemini-2.5-pro": {"input": 1.25, "output": 10.0},
    "gemini-2.5-flash": {"input": 0.15, "output": 0.6},
}

# Fallback cost for unknown models
DEFAULT_COST = {"input": 3.0, "output": 15.0}


@dataclass
class UsageRecord:
    """A single usage record for a model invocation."""

    model: str
    input_tokens: int
    output_tokens: int
    estimated_cost: float
    timestamp: float = field(default_factory=time.time)


@dataclass
class CostSummary:
    """Summary of token usage and estimated costs."""

    total_input_tokens: int = 0
    total_output_tokens: int = 0
    total_cost: float = 0.0
    records: list[UsageRecord] = field(default_factory=list)


class CostTracker:
    """
    Tracks token usage and estimated costs across all LLM calls.

    Maintains both per-task and daily running totals, and enforces
    configurable budget limits.
    """

    def __init__(self) -> None:
        self._task_summary = CostSummary()
        self._daily_summary = CostSummary()
        self._daily_reset_time: float = self._get_day_start()
        self._budget_per_task: float = 0.0  # 0 = unlimited
        self._budget_daily: float = 0.0  # 0 = unlimited

    def set_budget(
        self,
        per_task: float = 0.0,
        daily: float = 0.0,
    ) -> None:
        """
        Set budget limits in USD.

        Args:
            per_task: Maximum cost per pipeline task (0 = unlimited).
            daily: Maximum daily cost across all tasks (0 = unlimited).
        """
        self._budget_per_task = per_task
        self._budget_daily = daily

    def add_usage(
        self,
        model: str,
        input_tokens: int,
        output_tokens: int,
    ) -> float:
        """
        Record token usage for a model call.

        Args:
            model: Model identifier (e.g., "claude-sonnet-4-20250514").
            input_tokens: Number of input tokens consumed.
            output_tokens: Number of output tokens generated.

        Returns:
            Estimated cost in USD for this call.

        Raises:
            BudgetExceededError: If adding this usage exceeds a budget limit.
        """
        # Check if we need to reset daily totals
        self._maybe_reset_daily()

        # Calculate cost
        costs = MODEL_COSTS.get(model, DEFAULT_COST)
        estimated_cost = (
            (input_tokens / 1_000_000) * costs["input"]
            + (output_tokens / 1_000_000) * costs["output"]
        )

        record = UsageRecord(
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            estimated_cost=estimated_cost,
        )

        # Update task totals
        self._task_summary.total_input_tokens += input_tokens
        self._task_summary.total_output_tokens += output_tokens
        self._task_summary.total_cost += estimated_cost
        self._task_summary.records.append(record)

        # Update daily totals
        self._daily_summary.total_input_tokens += input_tokens
        self._daily_summary.total_output_tokens += output_tokens
        self._daily_summary.total_cost += estimated_cost
        self._daily_summary.records.append(record)

        # Check budget limits
        if self._budget_per_task > 0 and self._task_summary.total_cost > self._budget_per_task:
            raise BudgetExceededError(
                f"Per-task budget exceeded: ${self._task_summary.total_cost:.4f} "
                f"> ${self._budget_per_task:.2f}"
            )
        if self._budget_daily > 0 and self._daily_summary.total_cost > self._budget_daily:
            raise BudgetExceededError(
                f"Daily budget exceeded: ${self._daily_summary.total_cost:.4f} "
                f"> ${self._budget_daily:.2f}"
            )

        return estimated_cost

    def reset_task_cost(self) -> None:
        """Reset per-task cost tracking (called at start of each pipeline run)."""
        self._task_summary = CostSummary()

    def get_task_summary(self) -> dict[str, Any]:
        """Return a summary dict of the current task's costs."""
        return {
            "input_tokens": self._task_summary.total_input_tokens,
            "output_tokens": self._task_summary.total_output_tokens,
            "estimated_cost": round(self._task_summary.total_cost, 6),
            "num_calls": len(self._task_summary.records),
        }

    def get_daily_summary(self) -> dict[str, Any]:
        """Return a summary dict of today's cumulative costs."""
        self._maybe_reset_daily()
        return {
            "input_tokens": self._daily_summary.total_input_tokens,
            "output_tokens": self._daily_summary.total_output_tokens,
            "estimated_cost": round(self._daily_summary.total_cost, 6),
            "num_calls": len(self._daily_summary.records),
        }

    def _maybe_reset_daily(self) -> None:
        """Reset daily totals if we've crossed into a new day."""
        current_day_start = self._get_day_start()
        if current_day_start > self._daily_reset_time:
            self._daily_summary = CostSummary()
            self._daily_reset_time = current_day_start

    @staticmethod
    def _get_day_start() -> float:
        """Return the Unix timestamp for the start of the current UTC day."""
        now = time.time()
        return now - (now % 86400)


# Module-level singleton
cost_tracker = CostTracker()
