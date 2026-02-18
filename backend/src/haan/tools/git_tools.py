"""
Git operation tools for Haan.ai agents.

Provides 6 tools mirroring the TypeScript git-tools.ts:
- GitStatusTool:  Show working tree status
- GitDiffTool:    Show changes between commits / working tree
- GitCommitTool:  Stage files and create commits
- GitBranchTool:  List, create, or checkout branches
- GitPushTool:    Push commits to remote
- GitLogTool:     Show commit history
"""

from __future__ import annotations

import subprocess
from typing import Any

from crewai.tools import BaseTool as CrewAIBaseTool

from haan.utils.path_utils import get_project_root


def _git(args: str, timeout: int = 15) -> str:
    """
    Run a git command and return its output.

    Args:
        args: Git subcommand and arguments (without the 'git' prefix).
        timeout: Maximum execution time in seconds.

    Returns:
        Stripped stdout from the git command.

    Raises:
        subprocess.CalledProcessError: If the git command fails.
    """
    result = subprocess.run(
        f"git {args}",
        shell=True,
        capture_output=True,
        text=True,
        timeout=timeout,
        cwd=get_project_root(),
    )
    if result.returncode != 0 and result.stderr:
        raise subprocess.CalledProcessError(
            result.returncode, f"git {args}", result.stdout, result.stderr
        )
    return result.stdout.strip()


class GitStatusTool(CrewAIBaseTool):
    """Show the working tree status."""

    name: str = "git-status"
    description: str = (
        "Show the working tree status (staged, modified, untracked files). "
        "Returns both long and short format."
    )

    def _run(self) -> str:
        """Return git status in both long and short format."""
        try:
            status = _git("status")
            short = _git("status --short")
            return f"{status}\n\nShort:\n{short}"
        except Exception as e:
            return f"Error: git status failed: {e}"


class GitDiffTool(CrewAIBaseTool):
    """Show changes between commits, working tree, etc."""

    name: str = "git-diff"
    description: str = (
        "Show changes between commits, working tree, etc. "
        "Use staged=True for staged changes. Optionally specify a file."
    )

    def _run(
        self,
        staged: bool = False,
        file: str | None = None,
    ) -> str:
        """
        Show git diff output.

        Args:
            staged: If True, show staged changes (--cached).
            file: Optional specific file to diff.

        Returns:
            Diff output, truncated to 15000 chars if needed.
        """
        try:
            cmd = "diff"
            if staged:
                cmd += " --cached"
            if file:
                escaped = file.replace("'", "'\\''")
                cmd += f" -- '{escaped}'"

            diff = _git(cmd)
            if not diff:
                return "No changes."

            max_len = 15_000
            if len(diff) > max_len:
                return diff[:max_len] + f"\n...[diff truncated, {len(diff)} total chars]"
            return diff
        except Exception as e:
            return f"Error: git diff failed: {e}"


class GitCommitTool(CrewAIBaseTool):
    """Stage files and create a git commit."""

    name: str = "git-commit"
    description: str = (
        "Stage files and create a git commit. Specify files to stage, "
        "or omit to commit currently staged files."
    )

    def _run(
        self,
        message: str,
        files: list[str] | None = None,
    ) -> str:
        """
        Create a git commit.

        Args:
            message: Commit message.
            files: Optional list of files to stage before committing.

        Returns:
            Git commit output, or error message.
        """
        try:
            # Stage specified files
            if files:
                file_list = " ".join(
                    f"'{f.replace(chr(39), chr(39) + chr(92) + chr(39) + chr(39))}'"
                    for f in files
                )
                _git(f"add {file_list}")

            # Check if there's anything to commit
            try:
                _git("diff --cached --quiet")
                return "Error: Nothing to commit (no staged changes)."
            except subprocess.CalledProcessError:
                # Non-zero exit means there ARE staged changes — proceed
                pass

            escaped_message = message.replace("'", "'\\''")
            result = _git(f"commit -m '{escaped_message}'")
            return result
        except Exception as e:
            return f"Error: git commit failed: {e}"


class GitBranchTool(CrewAIBaseTool):
    """List branches or create/checkout a branch."""

    name: str = "git-branch"
    description: str = (
        "List branches (no args), create a branch (name only), "
        "or create+checkout (name + checkout=True)."
    )

    def _run(
        self,
        name: str | None = None,
        checkout: bool = False,
    ) -> str:
        """
        Manage git branches.

        Args:
            name: Branch name to create. Omit to list branches.
            checkout: If True, checkout the branch after creating.

        Returns:
            Branch list or operation result.
        """
        try:
            if not name:
                return _git("branch -a")

            if checkout:
                try:
                    _git(f"rev-parse --verify {name}")
                    result = _git(f"checkout {name}")
                    return f"Switched to branch: {name}\n{result}"
                except subprocess.CalledProcessError:
                    result = _git(f"checkout -b {name}")
                    return f"Created and switched to branch: {name}\n{result}"
            else:
                result = _git(f"branch {name}")
                return f"Created branch: {name}\n{result}"
        except Exception as e:
            return f"Error: git branch failed: {e}"


class GitPushTool(CrewAIBaseTool):
    """Push commits to a remote repository."""

    name: str = "git-push"
    description: str = (
        "Push commits to a remote repository. Defaults to 'origin' remote "
        "and current branch."
    )

    def _run(
        self,
        remote: str = "origin",
        branch: str | None = None,
        setUpstream: bool = False,
    ) -> str:
        """
        Push commits to remote.

        Args:
            remote: Remote name (default "origin").
            branch: Branch name (defaults to current branch).
            setUpstream: If True, set upstream tracking (-u flag).

        Returns:
            Push result or error message.
        """
        try:
            if not branch:
                branch = _git("rev-parse --abbrev-ref HEAD")

            if setUpstream:
                cmd = f"push -u {remote} {branch}"
            else:
                cmd = f"push {remote} {branch}"

            result = _git(cmd, timeout=30)
            return result or f"Pushed to {remote}/{branch}"
        except Exception as e:
            return f"Error: git push failed: {e}"


class GitLogTool(CrewAIBaseTool):
    """Show commit log."""

    name: str = "git-log"
    description: str = (
        "Show commit log. Defaults to last 10 commits in oneline format. "
        "Optionally filter by file."
    )

    def _run(
        self,
        count: int = 10,
        file: str | None = None,
    ) -> str:
        """
        Show git log.

        Args:
            count: Number of commits to show (default 10).
            file: Optional file path to show history for.

        Returns:
            Commit log output.
        """
        try:
            cmd = f"log --oneline --no-decorate -n {count}"
            if file:
                escaped = file.replace("'", "'\\''")
                cmd += f" -- '{escaped}'"

            log = _git(cmd)
            return log if log else "No commits found."
        except Exception as e:
            return f"Error: git log failed: {e}"
