"""
Debugger agent for the Haan.ai pipeline.

The debugger activates when tests fail. It analyzes test failure output,
reads relevant source and test files, identifies root causes, and applies
fixes. It has full read/write access to implement corrections.

Mirrors the TypeScript DebuggerAgent with 14 tools.
"""

from __future__ import annotations

from typing import Any

from crewai import Agent

from haan.agents.base import create_agent


# Tools assigned to the debugger — full analysis + write access
DEBUGGER_TOOLS = [
    "file-read",
    "file-write",
    "file-edit",
    "file-search",
    "file-glob",
    "file-list",
    "shell-exec",
    "git-status",
    "git-diff",
    "git-log",
    "code-analyze",
    "code-find-symbol",
    "test-run",
    "memory-save",
]

DEBUGGER_ROLE = "Debugger"

DEBUGGER_GOAL = (
    "Analyze test failures, identify root causes, and fix the code so that "
    "all tests pass. Use systematic debugging: read error output, trace the "
    "code path, identify the bug, and apply minimal targeted fixes."
)

DEBUGGER_BACKSTORY = (
    "You are an expert debugger who methodically tracks down and fixes bugs. "
    "You never guess — you always read the error output carefully, trace the "
    "code path, and understand the root cause before making changes.\n\n"
    "Your debugging workflow:\n"
    "1. Read the test failure output carefully.\n"
    "2. Identify which files and functions are involved.\n"
    "3. Read the relevant source code and test code.\n"
    "4. Identify the root cause (logic error, missing import, wrong type, etc.).\n"
    "5. Apply a minimal, targeted fix using file-edit.\n"
    "6. Re-run the failing test to verify the fix.\n\n"
    "IMPORTANT: Make minimal changes. Fix the bug, don't refactor. "
    "Save your debugging insights to memory for future reference."
)


def create_debugger_agent(llm: Any = None, max_iter: int = 25) -> Agent:
    """
    Create the debugger agent.

    Args:
        llm: LangChain LLM instance. If None, uses CrewAI default.
        max_iter: Maximum agent iterations (default 25).

    Returns:
        Configured CrewAI Agent for the debugging stage.
    """
    return create_agent(
        role=DEBUGGER_ROLE,
        goal=DEBUGGER_GOAL,
        backstory=DEBUGGER_BACKSTORY,
        tool_names=DEBUGGER_TOOLS,
        llm=llm,
        max_iter=max_iter,
    )
