"""
Tool registry and tool implementations for Haan.ai agents.

Provides 27+ tools organized by category:
- file_tools:   7 tools for file I/O (read, write, edit, delete, search, glob, list)
- shell_tools:  1 tool for shell command execution with safety checks
- git_tools:    6 tools for git operations (status, diff, commit, branch, push, log)
- web_tools:    2 tools for web interaction (search, fetch)
- code_tools:   2 tools for code analysis (analyze, find_symbol)
- test_tools:   4 tools for testing (discover, run, parse, coverage)
- memory_tools: 3 tools for persistent memory (save, load, search)

Each tool is a CrewAI-compatible BaseTool subclass registered with
the global tool registry at import time.
"""

from __future__ import annotations

from crewai.tools import BaseTool as CrewAIBaseTool

from haan.tools.file_tools import (
    FileDeleteTool,
    FileEditTool,
    FileGlobTool,
    FileListTool,
    FileReadTool,
    FileSearchTool,
    FileWriteTool,
)
from haan.tools.shell_tools import ShellExecTool
from haan.tools.git_tools import (
    GitBranchTool,
    GitCommitTool,
    GitDiffTool,
    GitLogTool,
    GitPushTool,
    GitStatusTool,
)
from haan.tools.web_tools import WebFetchTool, WebSearchTool
from haan.tools.code_tools import CodeAnalyzeTool, CodeFindSymbolTool
from haan.tools.test_tools import (
    TestCoverageTool,
    TestDiscoverTool,
    TestParseTool,
    TestRunTool,
)
from haan.tools.memory_tools import MemoryLoadTool, MemorySaveTool, MemorySearchTool


# ── Tool Registry ──
# Maps tool name -> tool class for easy lookup and agent assignment.
TOOL_CLASSES: dict[str, type[CrewAIBaseTool]] = {
    # File tools
    "file-read": FileReadTool,
    "file-write": FileWriteTool,
    "file-edit": FileEditTool,
    "file-delete": FileDeleteTool,
    "file-search": FileSearchTool,
    "file-glob": FileGlobTool,
    "file-list": FileListTool,
    # Shell
    "shell-exec": ShellExecTool,
    # Git
    "git-status": GitStatusTool,
    "git-diff": GitDiffTool,
    "git-commit": GitCommitTool,
    "git-branch": GitBranchTool,
    "git-push": GitPushTool,
    "git-log": GitLogTool,
    # Web
    "web-search": WebSearchTool,
    "web-fetch": WebFetchTool,
    # Code analysis
    "code-analyze": CodeAnalyzeTool,
    "code-find-symbol": CodeFindSymbolTool,
    # Testing
    "test-discover": TestDiscoverTool,
    "test-run": TestRunTool,
    "test-parse": TestParseTool,
    "test-coverage": TestCoverageTool,
    # Memory
    "memory-save": MemorySaveTool,
    "memory-load": MemoryLoadTool,
    "memory-search": MemorySearchTool,
}


def get_tools(names: list[str]) -> list[CrewAIBaseTool]:
    """
    Instantiate and return tool objects for the given tool names.

    Args:
        names: List of tool name strings (e.g., ["file-read", "shell-exec"]).

    Returns:
        List of instantiated CrewAI BaseTool objects.

    Raises:
        KeyError: If a tool name is not found in the registry.
    """
    tools: list[CrewAIBaseTool] = []
    for name in names:
        cls = TOOL_CLASSES.get(name)
        if cls is None:
            raise KeyError(f"Unknown tool: '{name}'. Available: {list(TOOL_CLASSES.keys())}")
        tools.append(cls())
    return tools


def get_all_tool_names() -> list[str]:
    """Return all registered tool names."""
    return list(TOOL_CLASSES.keys())


def get_all_tool_schemas() -> list[dict]:
    """Return JSON schemas for all registered tools (name + description)."""
    schemas = []
    for name, cls in TOOL_CLASSES.items():
        instance = cls()
        schemas.append({
            "name": name,
            "description": instance.description,
        })
    return schemas
