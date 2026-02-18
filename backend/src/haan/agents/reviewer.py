"""
Reviewer agent for the Haan.ai pipeline.

The reviewer is the final quality gate. It reviews all code changes made
during the pipeline, checking for correctness, style, security issues,
and best practices. It can trigger improvement passes if the code doesn't
meet quality standards.

Mirrors the TypeScript ReviewerAgent with 14 tools.
"""

from __future__ import annotations

from typing import Any

from crewai import Agent

from haan.agents.base import create_agent


# Tools assigned to the reviewer — full read access + analysis
REVIEWER_TOOLS = [
    "file-read",
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
    "test-coverage",
    "memory-load",
    "memory-search",
]

REVIEWER_ROLE = "Reviewer"

REVIEWER_GOAL = (
    "Review all code changes for correctness, style, security, and best practices. "
    "Provide a quality score (1-10) and specific, actionable feedback. "
    "Approve changes that meet standards, or reject with clear improvement suggestions."
)

REVIEWER_BACKSTORY = (
    "You are a senior code reviewer with expertise in multiple languages and "
    "frameworks. You have a keen eye for bugs, security vulnerabilities, and "
    "code quality issues.\n\n"
    "Your review process:\n"
    "1. Check git diff to see all changes made.\n"
    "2. Read each changed file to understand the context.\n"
    "3. Verify the changes match the original task requirements.\n"
    "4. Check for common issues: bugs, security, performance, style.\n"
    "5. Run tests to ensure everything still passes.\n"
    "6. Provide a score and actionable feedback.\n\n"
    "Your output MUST be a JSON object:\n"
    "```json\n"
    "{\n"
    '  "approved": true|false,\n'
    '  "score": 1-10,\n'
    '  "summary": "Brief review summary",\n'
    '  "issues": [\n'
    "    {\n"
    '      "severity": "critical|major|minor|suggestion",\n'
    '      "file": "path/to/file",\n'
    '      "line": 42,\n'
    '      "description": "Issue description",\n'
    '      "suggestion": "How to fix"\n'
    "    }\n"
    "  ],\n"
    '  "strengths": ["Good thing 1", "Good thing 2"]\n'
    "}\n"
    "```\n\n"
    "Score guidelines:\n"
    "- 9-10: Excellent, ready to merge\n"
    "- 7-8: Good, minor issues only\n"
    "- 5-6: Needs improvement, significant issues\n"
    "- 1-4: Major problems, needs rework"
)


def create_reviewer_agent(llm: Any = None, max_iter: int = 25) -> Agent:
    """
    Create the reviewer agent.

    Args:
        llm: LangChain LLM instance. If None, uses CrewAI default.
        max_iter: Maximum agent iterations (default 25).

    Returns:
        Configured CrewAI Agent for the review stage.
    """
    return create_agent(
        role=REVIEWER_ROLE,
        goal=REVIEWER_GOAL,
        backstory=REVIEWER_BACKSTORY,
        tool_names=REVIEWER_TOOLS,
        llm=llm,
        max_iter=max_iter,
    )
