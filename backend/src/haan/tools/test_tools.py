"""
Testing tools for Haan.ai agents.

Provides 4 tools mirroring the TypeScript test-tools.ts:
- TestDiscoverTool:  Find test files in the project
- TestRunTool:       Run the test suite (auto-detects runner)
- TestParseTool:     Parse test output for pass/fail counts
- TestCoverageTool:  Run tests with coverage reporting
"""

from __future__ import annotations

import json
import os
import re
import subprocess
from pathlib import Path
from typing import Any

from crewai.tools import BaseTool as CrewAIBaseTool

from haan.utils.logger import logger
from haan.utils.path_utils import get_project_root, safe_path


# Patterns that identify test files
TEST_FILE_PATTERNS = [
    re.compile(r"\.test\.\w+$"),
    re.compile(r"\.spec\.\w+$"),
    re.compile(r"_test\.\w+$"),
    re.compile(r"test_.*\.\w+$"),
]

# Directories to skip during discovery
SKIP_DIRS = {".git", "node_modules", "dist", "__pycache__", ".venv", "venv"}


class TestDiscoverTool(CrewAIBaseTool):
    """Find test files in the project."""

    name: str = "test-discover"
    description: str = (
        "Find test files in the project. Searches for files matching common test patterns "
        "(*.test.*, *.spec.*, *_test.*, test_*.*) and files in test directories."
    )

    def _run(self, path: str = ".") -> str:
        """
        Discover test files.

        Args:
            path: Directory to search (relative to project root).

        Returns:
            Newline-separated list of test file paths.
        """
        try:
            search_path = Path(safe_path(path))
            root = get_project_root()
            test_files = self._find_test_files(search_path)

            if not test_files:
                return "No test files found."

            relative = [str(f).replace(root + "/", "") for f in test_files]
            return "\n".join(relative) + f"\n\n({len(test_files)} test files)"
        except Exception as e:
            return f"Error: Test discovery failed: {e}"

    @staticmethod
    def _find_test_files(directory: Path) -> list[Path]:
        """Recursively find test files in a directory."""
        results: list[Path] = []

        def _walk(d: Path) -> None:
            try:
                entries = sorted(d.iterdir())
            except PermissionError:
                return
            for entry in entries:
                if entry.name.startswith(".") or entry.name in SKIP_DIRS:
                    continue
                if entry.is_dir():
                    _walk(entry)
                elif entry.is_file():
                    name = entry.name
                    matches_pattern = any(p.search(name) for p in TEST_FILE_PATTERNS)
                    in_test_dir = any(
                        part in ("test", "tests", "__tests__")
                        for part in entry.parts
                    )
                    if matches_pattern or in_test_dir:
                        results.append(entry)

        _walk(directory)
        return sorted(results)


class TestRunTool(CrewAIBaseTool):
    """Run the test suite with auto-detection of test runner."""

    name: str = "test-run"
    description: str = (
        "Run the test suite. Auto-detects the test runner (npm test, vitest, jest, "
        "pytest, go test, cargo test) if no command is specified."
    )

    def _run(
        self,
        command: str | None = None,
        path: str | None = None,
    ) -> str:
        """
        Run tests.

        Args:
            command: Explicit test command (overrides auto-detection).
            path: Path to specific test file or directory.

        Returns:
            Test output, or error message with failure details.
        """
        try:
            root = get_project_root()
            test_path = safe_path(path) if path else None

            if not command:
                command = self._detect_test_command(root, test_path)
                if not command:
                    return (
                        "Error: Could not auto-detect test command. "
                        "No test runner found. Specify a command explicitly."
                    )

            logger.info("test-run", f"Running: {command}")

            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=120,
                cwd=root,
                env={**os.environ, "FORCE_COLOR": "0", "CI": "true"},
            )

            output = result.stdout
            if result.stderr:
                output += "\n" + result.stderr

            # Truncate large output
            if len(output) > 10_000:
                output = output[:10_000] + "\n...[output truncated]"

            if result.returncode != 0:
                return f"Tests failed (exit code {result.returncode}):\n{output}"

            return output
        except subprocess.TimeoutExpired:
            return "Error: Tests timed out after 120 seconds."
        except Exception as e:
            return f"Error: Test run failed: {e}"

    @staticmethod
    def _detect_test_command(root: str, test_path: str | None = None) -> str | None:
        """
        Auto-detect the appropriate test command for the project.

        Checks for common test runners in this order:
        npm test, vitest, jest, pytest, go test, cargo test.
        """
        suffix = f" {test_path}" if test_path else ""
        root_path = Path(root)

        # Node.js projects
        pkg_path = root_path / "package.json"
        if pkg_path.exists():
            try:
                pkg = json.loads(pkg_path.read_text())
                scripts = pkg.get("scripts", {})
                test_script = scripts.get("test", "")
                if test_script and "no test specified" not in test_script:
                    return f"npm test{' --' + suffix if suffix else ''}"
            except (json.JSONDecodeError, KeyError):
                pass

            # Vitest
            if (root_path / "vitest.config.ts").exists() or (
                root_path / "vitest.config.js"
            ).exists():
                return f"npx vitest run{suffix}"

            # Jest
            if (root_path / "jest.config.ts").exists() or (
                root_path / "jest.config.js"
            ).exists():
                return f"npx jest{suffix}"

        # Python (pytest)
        if any(
            (root_path / f).exists()
            for f in ("pytest.ini", "setup.py", "pyproject.toml")
        ):
            return f"pytest{suffix}"

        # Go
        if (root_path / "go.mod").exists():
            return f"go test{suffix or ' ./...'}"

        # Rust
        if (root_path / "Cargo.toml").exists():
            return f"cargo test{suffix}"

        return None


class TestParseTool(CrewAIBaseTool):
    """Parse test output to extract pass/fail counts."""

    name: str = "test-parse"
    description: str = (
        "Parse test output to extract pass/fail counts and summary. "
        "Supports Jest, Vitest, pytest, and Go test output formats."
    )

    def _run(self, output: str) -> str:
        """
        Parse test output.

        Args:
            output: Raw test output to parse.

        Returns:
            JSON string with parsed results (passed, failed, skipped, total, errors).
        """
        try:
            result = self._parse_test_output(output)
            return json.dumps(result, indent=2)
        except Exception as e:
            return f"Error: Parse failed: {e}"

    @staticmethod
    def _parse_test_output(output: str) -> dict[str, Any]:
        """
        Parse test output from various test runners.

        Supports: Jest/Vitest, pytest, Go test, and generic pass/fail counting.
        """
        result: dict[str, Any] = {
            "passed": 0,
            "failed": 0,
            "skipped": 0,
            "total": 0,
            "errors": [],
            "summary": "",
        }

        # Jest / Vitest: "Tests:  2 failed, 5 passed, 7 total"
        jest_fail = re.search(
            r"Tests:\s+(\d+)\s+failed.*?(\d+)\s+passed.*?(\d+)\s+total", output
        )
        if jest_fail:
            result["failed"] = int(jest_fail.group(1))
            result["passed"] = int(jest_fail.group(2))
            result["total"] = int(jest_fail.group(3))
            result["summary"] = jest_fail.group(0)
            return result

        jest_pass = re.search(r"Tests:\s+(\d+)\s+passed,\s+(\d+)\s+total", output)
        if jest_pass:
            result["passed"] = int(jest_pass.group(1))
            result["total"] = int(jest_pass.group(2))
            result["summary"] = jest_pass.group(0)
            return result

        # Pytest: "5 passed, 2 failed, 1 skipped"
        pytest_match = re.search(
            r"(\d+)\s+passed(?:,\s+(\d+)\s+failed)?(?:,\s+(\d+)\s+skipped)?", output
        )
        if pytest_match:
            result["passed"] = int(pytest_match.group(1))
            result["failed"] = int(pytest_match.group(2) or 0)
            result["skipped"] = int(pytest_match.group(3) or 0)
            result["total"] = result["passed"] + result["failed"] + result["skipped"]
            result["summary"] = pytest_match.group(0)
            return result

        # Go test: count "ok" and "FAIL" lines
        go_pass = re.findall(r"ok\s+\S+", output)
        go_fail = re.findall(r"FAIL\s+\S+", output)
        if go_pass or go_fail:
            result["passed"] = len(go_pass)
            result["failed"] = len(go_fail)
            result["total"] = result["passed"] + result["failed"]
            result["summary"] = f"Go: {result['passed']} passed, {result['failed']} failed"
            return result

        # Generic: count lines with pass/fail keywords
        passed = 0
        failed = 0
        errors: list[str] = []
        for line in output.split("\n"):
            if re.search(r"\bpass(?:ed)?\b", line, re.IGNORECASE) and re.search(
                r"\b(?:test|spec|it)\b", line, re.IGNORECASE
            ):
                passed += 1
            if re.search(r"\bfail(?:ed)?\b", line, re.IGNORECASE) and re.search(
                r"\b(?:test|spec|it)\b", line, re.IGNORECASE
            ):
                failed += 1
                errors.append(line.strip())

        result["passed"] = passed
        result["failed"] = failed
        result["total"] = passed + failed
        result["errors"] = errors
        result["summary"] = f"{passed} passed, {failed} failed out of {passed + failed}"
        return result


class TestCoverageTool(CrewAIBaseTool):
    """Run tests with coverage and return results."""

    name: str = "test-coverage"
    description: str = (
        "Run tests with coverage reporting. Supports vitest, jest, pytest, and go test. "
        "Auto-detects the coverage command if not specified."
    )

    def _run(
        self,
        testCommand: str | None = None,
        path: str | None = None,
    ) -> str:
        """
        Run tests with coverage.

        Args:
            testCommand: The test command with coverage flags. Auto-detected if omitted.
            path: Focus coverage on a specific path/module.

        Returns:
            Coverage output, or error message.
        """
        try:
            root = get_project_root()
            command = testCommand or self._detect_coverage_command(root)

            if not command:
                return (
                    "Error: Could not detect test framework. "
                    "Provide a testCommand explicitly."
                )

            logger.info("test-coverage", f"Running coverage: {command}")

            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=120,
                cwd=root,
            )

            output = result.stdout
            if result.stderr:
                output += "\n" + result.stderr

            # If command failed and no coverage info, report error
            if result.returncode != 0 and not any(
                kw in output.lower() for kw in ("coverage", "%")
            ):
                return f"Error: Coverage command failed:\n{output[:1000]}"

            # Truncate if needed
            if len(output) > 15_000:
                output = output[:15_000] + "\n\n[Output truncated]"

            return output
        except subprocess.TimeoutExpired:
            return "Error: Coverage timed out after 120 seconds."
        except Exception as e:
            return f"Error: Coverage failed: {e}"

    @staticmethod
    def _detect_coverage_command(root: str) -> str | None:
        """Auto-detect the coverage command for the project."""
        root_path = Path(root)

        # Node.js
        pkg_path = root_path / "package.json"
        if pkg_path.exists():
            try:
                pkg = json.loads(pkg_path.read_text())
                deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
                if "vitest" in deps:
                    return "npx vitest run --coverage --reporter=verbose 2>&1"
                if "jest" in deps:
                    return "npx jest --coverage --verbose 2>&1"
            except (json.JSONDecodeError, KeyError):
                pass

        # Python
        if any(
            (root_path / f).exists()
            for f in ("pyproject.toml", "requirements.txt", "setup.py")
        ):
            return "python -m pytest --cov=. --cov-report=term-missing 2>&1"

        # Go
        if (root_path / "go.mod").exists():
            return "go test -cover ./... 2>&1"

        return None
