"""
Agent creation helpers for the Haan.ai pipeline.

Provides factory functions to create CrewAI Agent and Task objects
with consistent configuration, tool assignment, and step callbacks
that emit events to the async event bus.
"""

from __future__ import annotations

from typing import Any, Callable

from crewai import Agent, Task

from haan.tools import get_tools
from haan.utils.event_bus import event_bus
from haan.utils.logger import logger


def create_agent(
    role: str,
    goal: str,
    backstory: str,
    tool_names: list[str],
    *,
    llm: Any = None,
    max_iter: int = 25,
    verbose: bool = True,
    allow_delegation: bool = False,
    memory: bool = True,
) -> Agent:
    """
    Create a CrewAI Agent with Haan.ai tool assignments and event callbacks.

    Args:
        role: Agent role name (e.g., "Planner", "Builder").
        goal: Agent's primary objective description.
        backstory: Context and personality for the agent.
        tool_names: List of tool name strings to assign to this agent.
        llm: LangChain LLM instance. If None, CrewAI uses its default.
        max_iter: Maximum iterations for the agent loop (default 25).
        verbose: Enable verbose output (default True).
        allow_delegation: Allow this agent to delegate to others (default False).
        memory: Enable agent memory (default True).

    Returns:
        Configured CrewAI Agent instance.
    """
    # Instantiate tool objects from the registry
    tools = get_tools(tool_names)

    # Build step callback that emits events to the event bus
    def step_callback(step_output: Any) -> None:
        """Emit agent events for each step in the agent loop."""
        agent_name = role.lower()

        # Emit thinking event
        event_bus.emit_sync("agent:thinking", {
            "agent": agent_name,
            "iteration": getattr(step_output, "iteration", 0),
        })

        # If the step includes a tool call, emit tool events
        if hasattr(step_output, "tool") and step_output.tool:
            event_bus.emit_sync("agent:tool_call", {
                "agent": agent_name,
                "tool": step_output.tool,
                "args": getattr(step_output, "tool_input", {}),
            })

        # If there's text output, emit streaming event
        if hasattr(step_output, "log") and step_output.log:
            event_bus.emit_sync("agent:streaming", {
                "agent": agent_name,
                "text": str(step_output.log)[:500],
            })

        logger.debug(agent_name, f"Step completed", {
            "tool": getattr(step_output, "tool", None),
        })

    agent_kwargs: dict[str, Any] = {
        "role": role,
        "goal": goal,
        "backstory": backstory,
        "tools": tools,
        "max_iter": max_iter,
        "verbose": verbose,
        "allow_delegation": allow_delegation,
        "memory": memory,
        "step_callback": step_callback,
    }

    # Only pass llm if provided (let CrewAI use its default otherwise)
    if llm is not None:
        agent_kwargs["llm"] = llm

    return Agent(**agent_kwargs)


def create_task(
    description: str,
    agent: Agent,
    expected_output: str = "A detailed response addressing the task requirements.",
    context: list[Task] | None = None,
) -> Task:
    """
    Create a CrewAI Task with consistent configuration.

    Args:
        description: Full task description for the agent.
        agent: The agent assigned to execute this task.
        expected_output: Description of the expected output format.
        context: Optional list of prerequisite tasks whose outputs provide context.

    Returns:
        Configured CrewAI Task instance.
    """
    task_kwargs: dict[str, Any] = {
        "description": description,
        "agent": agent,
        "expected_output": expected_output,
    }
    if context:
        task_kwargs["context"] = context

    return Task(**task_kwargs)
