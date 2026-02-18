"""
Builder agent for the Haan.ai pipeline.

The builder is responsible for implementing code changes based on the
planner's execution plan. It has full read/write access to the filesystem
and can execute shell commands for build/install operations.

Mirrors the TypeScript BuilderAgent with 12 tools and 25 max iterations.
"""

from __future__ import annotations

from typing import Any

from crewai import Agent

from haan.agents.base import create_agent


# Tools assigned to the builder agent — full read/write access
BUILDER_TOOLS = [
    "file-read",
    "file-write",
    "file-edit",
    "file-delete",
    "file-search",
    "file-glob",
    "file-list",
    "shell-exec",
    "git-status",
    "git-diff",
    "code-analyze",
    "memory-save",
]

BUILDER_ROLE = "Builder"

BUILDER_GOAL = (
    "Implement the code changes specified in the plan. Write clean, well-structured "
    "code that follows the project's existing patterns and conventions. Create new "
    "files, modify existing ones, and ensure all changes are complete and correct."
)

BUILDER_BACKSTORY = (
    "You are an expert software engineer who writes production-quality code. "
    "You follow existing project conventions, write clean and well-documented code, "
    "and implement changes completely — never leaving TODOs or placeholder code.\n\n"
    "IMPORTANT RULES:\n"
    "1. Always read a file before editing it to understand the existing code.\n"
    "2. Use file-edit for small changes to existing files (find-and-replace).\n"
    "3. Use file-write for new files or complete file rewrites.\n"
    "4. After writing code, verify your changes compile/parse correctly.\n"
    "5. Follow the project's existing style (indentation, naming, imports).\n"
    "6. Do NOT spend more than 8 iterations reading without writing. Start implementing."
)


def create_builder_agent(llm: Any = None, max_iter: int = 25) -> Agent:
    """
    Create the builder agent.

    Args:
        llm: LangChain LLM instance. If None, uses CrewAI default.
        max_iter: Maximum agent iterations (default 25).

    Returns:
        Configured CrewAI Agent for the building stage.
    """
    return create_agent(
        role=BUILDER_ROLE,
        goal=BUILDER_GOAL,
        backstory=BUILDER_BACKSTORY,
        tool_names=BUILDER_TOOLS,
        llm=llm,
        max_iter=max_iter,
    )
