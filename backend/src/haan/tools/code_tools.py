"""
Code analysis tools for Haan.ai agents.

Provides 2 tools mirroring the TypeScript code-tools.ts:
- CodeAnalyzeTool:     Analyze code structure (imports, exports, symbols)
- CodeFindSymbolTool:  Search for symbol definitions across the codebase
"""

from __future__ import annotations

import os
import re
import subprocess
from pathlib import Path
from typing import Any

from crewai.tools import BaseTool as CrewAIBaseTool

from haan.utils.path_utils import get_project_root, relative_path, safe_path


# Directories to skip during code analysis
SKIP_DIRS = {".git", "node_modules", "dist", "__pycache__", ".venv", "venv", ".tox"}

# Source file extensions to include in analysis
SOURCE_EXTENSIONS = {
    ".ts", ".tsx", ".js", ".jsx",
    ".py", ".go", ".rs", ".java",
    ".c", ".cpp", ".h", ".hpp",
    ".rb", ".php", ".swift", ".kt",
}


class CodeAnalyzeTool(CrewAIBaseTool):
    """Analyze code structure of a file or project."""

    name: str = "code-analyze"
    description: str = (
        "Analyze code structure of a file or project directory. "
        "For directories: reads package.json/pyproject.toml and lists source files. "
        "For files: finds imports, exports, classes, and functions."
    )

    def _run(self, path: str) -> str:
        """
        Analyze code structure.

        Args:
            path: File or directory path relative to project root.

        Returns:
            Structured analysis output.
        """
        try:
            target = Path(safe_path(path))
            if not target.exists():
                return f"Error: Path not found: {path}"

            if target.is_dir():
                return self._analyze_directory(target)
            else:
                return self._analyze_file(target)
        except Exception as e:
            return f"Error: Analysis failed: {e}"

    def _analyze_directory(self, dir_path: Path) -> str:
        """Analyze a project directory structure."""
        sections: list[str] = []

        # Check for package.json (Node.js)
        pkg_path = dir_path / "package.json"
        if pkg_path.exists():
            import json
            try:
                pkg = json.loads(pkg_path.read_text())
                sections.append("=== package.json ===")
                sections.append(f"Name: {pkg.get('name', 'unnamed')}")
                sections.append(f"Version: {pkg.get('version', 'unversioned')}")
                if pkg.get("description"):
                    sections.append(f"Description: {pkg['description']}")
                if pkg.get("main"):
                    sections.append(f"Main: {pkg['main']}")
                if pkg.get("scripts"):
                    sections.append(f"Scripts: {', '.join(pkg['scripts'].keys())}")
                deps = pkg.get("dependencies", {})
                if deps:
                    sections.append(f"Dependencies ({len(deps)}): {', '.join(deps.keys())}")
                dev_deps = pkg.get("devDependencies", {})
                if dev_deps:
                    sections.append(
                        f"DevDependencies ({len(dev_deps)}): {', '.join(dev_deps.keys())}"
                    )
            except (json.JSONDecodeError, KeyError):
                sections.append("package.json: failed to parse")

        # Check for pyproject.toml (Python)
        pyproject_path = dir_path / "pyproject.toml"
        if pyproject_path.exists():
            sections.append("\n=== pyproject.toml ===")
            sections.append("Python project detected")

        # Check for tsconfig.json (TypeScript)
        if (dir_path / "tsconfig.json").exists():
            sections.append("\n=== tsconfig.json ===")
            sections.append("TypeScript project detected")

        # List source files
        src_dir = dir_path / "src"
        search_dir = src_dir if src_dir.exists() else dir_path
        sections.append(f"\n=== Source Structure ({relative_path(str(search_dir))}) ===")

        files = self._collect_source_files(search_dir)
        root = get_project_root()
        for f in files[:50]:
            sections.append(str(f).replace(root + "/", ""))
        if len(files) > 50:
            sections.append(f"... and {len(files) - 50} more files")

        return "\n".join(sections)

    def _analyze_file(self, file_path: Path) -> str:
        """Analyze a single source file for imports, exports, and symbols."""
        content = file_path.read_text(encoding="utf-8", errors="replace")
        lines = content.split("\n")
        sections: list[str] = []
        rel = relative_path(str(file_path))

        sections.append(f"=== {rel} ===")
        sections.append(f"Lines: {len(lines)}")

        # Find imports
        imports: list[str] = []
        for line in lines:
            # JavaScript/TypeScript imports
            m = re.match(r"^import\s+.*from\s+['\"](.+)['\"]", line)
            if m:
                imports.append(m.group(1))
                continue
            # Python imports
            m = re.match(r"^(?:from\s+(\S+)\s+import|import\s+(\S+))", line)
            if m:
                imports.append(m.group(1) or m.group(2))
                continue
            # CommonJS require
            m = re.search(r"require\s*\(\s*['\"](.+)['\"]\s*\)", line)
            if m:
                imports.append(m.group(1))

        if imports:
            sections.append(f"\nImports ({len(imports)}):")
            for imp in imports:
                sections.append(f"  {imp}")

        # Find exports (JS/TS)
        exports: list[str] = []
        for line in lines:
            m = re.match(
                r"^export\s+(?:default\s+)?"
                r"(class|function|const|let|var|interface|type|enum|abstract\s+class)\s+(\w+)",
                line,
            )
            if m:
                exports.append(f"{m.group(1)} {m.group(2)}")

        if exports:
            sections.append(f"\nExports ({len(exports)}):")
            for exp in exports:
                sections.append(f"  {exp}")

        # Find all symbol definitions
        symbols: list[str] = []
        for i, line in enumerate(lines):
            # Classes
            m = re.match(r"\s*(?:abstract\s+)?class\s+(\w+)", line)
            if m:
                symbols.append(f"class {m.group(1)} (line {i + 1})")
            # Functions (JS/TS/Python)
            m = re.match(r"\s*(?:async\s+)?(?:function|def)\s+(\w+)", line)
            if m:
                symbols.append(f"function {m.group(1)} (line {i + 1})")

        if symbols:
            sections.append(f"\nSymbols ({len(symbols)}):")
            for sym in symbols:
                sections.append(f"  {sym}")

        return "\n".join(sections)

    @staticmethod
    def _collect_source_files(directory: Path) -> list[Path]:
        """Recursively collect source files, skipping excluded directories."""
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
                elif entry.suffix in SOURCE_EXTENSIONS:
                    results.append(entry)

        _walk(directory)
        return results


class CodeFindSymbolTool(CrewAIBaseTool):
    """Search for symbol definitions across the codebase."""

    name: str = "code-find-symbol"
    description: str = (
        "Search for symbol definitions (class, function, const, interface, type, def, func) "
        "across the codebase. Returns matching file paths and line numbers."
    )

    def _run(self, symbol: str, path: str = "src") -> str:
        """
        Search for symbol definitions.

        Args:
            symbol: Symbol name to search for.
            path: Directory to search in (relative to project root).

        Returns:
            Matching definitions with file paths and line numbers.
        """
        try:
            search_path = safe_path(path)
            root = get_project_root()

            # Build a pattern that matches common definition forms across languages
            patterns = [
                rf"(class|interface|type|enum|function|const|let|var|abstract class)\s+{re.escape(symbol)}\b",
                rf"def\s+{re.escape(symbol)}\s*\(",   # Python
                rf"func\s+{re.escape(symbol)}\s*\(",   # Go
                rf"fn\s+{re.escape(symbol)}\s*[(<]",    # Rust
            ]
            combined = "|".join(patterns)

            # Try ripgrep first, fall back to grep
            try:
                subprocess.run(["which", "rg"], capture_output=True, check=True)
                cmd = [
                    "rg", "--no-heading", "--line-number",
                    "--max-count", "50", "-e", combined, search_path,
                ]
            except subprocess.CalledProcessError:
                cmd = [
                    "grep", "-rn", "--max-count=50",
                    "-E", combined, search_path,
                ]

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=10,
                cwd=root,
            )

            output = result.stdout.strip()
            if not output:
                return f"No definitions found for symbol: {symbol}"

            # Relativize paths
            relativized = output.replace(root + "/", "")
            return relativized

        except subprocess.TimeoutExpired:
            return "Error: Symbol search timed out."
        except Exception as e:
            return f"Error: Symbol search failed: {e}"
