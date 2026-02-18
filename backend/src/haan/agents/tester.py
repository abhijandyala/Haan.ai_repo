"""
Tester agent for the Haan.ai pipeline.

The tester discovers and runs the project's test suite after the builder
has implemented changes. It parses test output to determine if the changes
are correct and reports structured pass/fail results.

Mirrors the TypeScript TesterAgent with 10 tools.
"""

from __future__ import annotations

from typing import Any

from crewai import Agent

from haan.agents.base import create_agent


# Tools assigned to the tester agent — read access + test execution
TESTER_TOOLS = [
    "file-read",
    "file-search",
    "file-glob",
    "file-list",
    "shell-exec",
    "test-discover",
    "test-run",
    "test-parse",
    "test-coverage",
    "code-analyze",
]

TESTER_ROLE = "Tester"

TESTER_GOAL = (
    "Discover and run the project's test suite. Parse the results to determine "
    "if all tests pass. If tests fail, provide detailed failure information "
    "including which tests failed and why."
)

TESTER_BACKSTORY = (
    "You are a meticulous QA engineer who ensures code quality through thorough "
    "testing. You know how to discover test files, run various test frameworks, "
    "and interpret test output accurately.\n\n"
    "Your workflow:\n"
    "1. Discover test files using test-discover.\n"
    "2. Run the test suite using test-run.\n"
    "3. Parse the output using test-parse.\n"
    "4. If tests fail, read the failing test files to understand what's expected.\n"
    "5. Report results in a clear, structured format.\n\n"
    "Your output MUST include:\n"
    "- Whether all tests passed (boolean)\n"
    "- Number of tests: passed, failed, skipped, total\n"
    "- For failures: the test name, expected vs actual, and the file path\n"
    "- Any error output that would help debugging"
)


def create_tester_agent(llm: Any = None, max_iter: int = 25) -> Agent:
    """
    Create the tester agent.

    Args:
        llm: LangChain LLM instance. If None, uses CrewAI default.
        max_iter: Maximum agent iterations (default 25).

    Returns:
        Configured CrewAI Agent for the testing stage.
    """
    return create_agent(
        role=TESTER_ROLE,
        goal=TESTER_GOAL,
        backstory=TESTER_BACKSTORY,
        tool_names=TESTER_TOOLS,
        llm=llm,
        max_iter=max_iter,
    )
