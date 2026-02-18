"""
Planner agent for the Haan.ai pipeline.

The planner is the first stage in the pipeline. It analyzes the user's task,
explores the codebase, and produces a structured execution plan with steps,
dependencies, and risk assessments.

Mirrors the TypeScript PlannerAgent with 11 tools and 25 max iterations.
"""

from __future__ import annotations

from typing import Any

from crewai import Agent

from haan.agents.base import create_agent


# Tools assigned to the planner agent — read-only + analysis + memory
PLANNER_TOOLS = [
    "file-read",
    "file-search",
    "file-glob",
    "file-list",
    "shell-exec",
    "git-status",
    "git-log",
    "web-search",
    "web-fetch",
    "code-analyze",
    "memory-load",
]

PLANNER_ROLE = "Planner"

PLANNER_GOAL = (
    "Analyze the given software engineering task and produce a detailed, "
    "actionable execution plan. The plan must include specific file changes, "
    "dependencies between steps, and risk assessments."
)

PLANNER_BACKSTORY = (
    "You are an expert software architect and project planner. You excel at "
    "understanding codebases, breaking down complex tasks into clear steps, "
    "and anticipating potential issues. You always explore the existing code "
    "before planning changes, and you produce structured plans in JSON format.\n\n"
    "Your output MUST be a JSON object with this structure:\n"
    "```json\n"
    "{\n"
    '  "summary": "Brief description of the plan",\n'
    '  "steps": [\n'
    "    {\n"
    '      "id": 1,\n'
    '      "action": "create|modify|delete",\n'
    '      "file": "path/to/file",\n'
    '      "description": "What to do",\n'
    '      "details": "Detailed implementation notes",\n'
    '      "dependencies": [],\n'
    '      "risk": "low|medium|high"\n'
    "    }\n"
    "  ],\n"
    '  "risks": ["Potential risk 1", "Potential risk 2"],\n'
    '  "notes": "Additional notes"\n'
    "}\n"
    "```"
)


def create_planner_agent(llm: Any = None, max_iter: int = 25) -> Agent:
    """
    Create the planner agent.

    Args:
        llm: LangChain LLM instance. If None, uses CrewAI default.
        max_iter: Maximum agent iterations (default 25).

    Returns:
        Configured CrewAI Agent for the planning stage.
    """
    return create_agent(
        role=PLANNER_ROLE,
        goal=PLANNER_GOAL,
        backstory=PLANNER_BACKSTORY,
        tool_names=PLANNER_TOOLS,
        llm=llm,
        max_iter=max_iter,
    )
