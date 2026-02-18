import fs from 'fs';
import path from 'path';
import { BaseTool, ToolResult } from './types.js';
import { safePath, getProjectRoot } from '../utils/path-utils.js';
import { logger } from '../utils/logger.js';

/**
 * Find all usages of a symbol (function, class, variable) across the project.
 * Uses regex-based search — not a full AST parse — for broad language support.
 */
export class AstFindSymbolTool extends BaseTool {
  name = 'ast-find-symbol';
  description = 'Find all usages of a function, class, or variable by name across the project. Returns file paths, line numbers, and context.';
  parameters = {
    type: 'object' as const,
    properties: {
      symbol: { type: 'string', description: 'The symbol name to find (e.g., "handleRequest", "UserModel")' },
      path: { type: 'string', description: 'Directory to search in (relative to project root, defaults to "src")' },
      type: { type: 'string', description: 'Symbol type filter: "function", "class", "variable", "type", or "all" (default: "all")' },
    },
    required: ['symbol'],
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const symbol = params.symbol as string;
      const searchPath = safePath((params.path as string) || 'src');
      const symbolType = (params.type as string) || 'all';

      if (!symbol || symbol.length < 2) {
        return this.error('Symbol name must be at least 2 characters');
      }

      const results = this.findSymbol(searchPath, symbol, symbolType);

      if (results.length === 0) {
        return this.success(`No usages found for "${symbol}" in ${searchPath}`);
      }

      const output = results.map(r =>
        `${r.file}:${r.line}  [${r.kind}]  ${r.context.trim()}`
      ).join('\n');

      return this.success(output, {
        symbol,
        count: results.length,
        files: [...new Set(results.map(r => r.file))],
      });
    } catch (err) {
      return this.error(`Symbol search failed: ${(err as Error).message}`);
    }
  }

  private findSymbol(dir: string, symbol: string, typeFilter: string): Array<{
    file: string;
    line: number;
    kind: string;
    context: string;
  }> {
    const results: Array<{ file: string; line: number; kind: string; context: string }> = [];
    const root = getProjectRoot();
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go', '.java', '.rb'];

    const walk = (d: string) => {
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(d, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'build') continue;
        const full = path.join(d, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (extensions.some(ext => entry.name.endsWith(ext))) {
          this.searchFile(full, symbol, typeFilter, root, results);
        }
      }
    };

    walk(dir);
    return results.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  }

  private searchFile(
    filePath: string,
    symbol: string,
    typeFilter: string,
    root: string,
    results: Array<{ file: string; line: number; kind: string; context: string }>,
  ): void {
    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch {
      return;
    }

    const relativePath = filePath.replace(root + '/', '');
    const lines = content.split('\n');
    const escapedSymbol = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Build patterns based on type filter
    const patterns: Array<{ regex: RegExp; kind: string }> = [];

    if (typeFilter === 'all' || typeFilter === 'function') {
      patterns.push(
        { regex: new RegExp(`\\bfunction\\s+${escapedSymbol}\\b`), kind: 'definition' },
        { regex: new RegExp(`\\b(?:const|let|var)\\s+${escapedSymbol}\\s*=\\s*(?:async\\s+)?(?:function|\\()`), kind: 'definition' },
        { regex: new RegExp(`\\b${escapedSymbol}\\s*\\(`), kind: 'call' },
      );
    }

    if (typeFilter === 'all' || typeFilter === 'class') {
      patterns.push(
        { regex: new RegExp(`\\bclass\\s+${escapedSymbol}\\b`), kind: 'class-def' },
        { regex: new RegExp(`\\bnew\\s+${escapedSymbol}\\b`), kind: 'instantiation' },
        { regex: new RegExp(`\\bextends\\s+${escapedSymbol}\\b`), kind: 'extends' },
        { regex: new RegExp(`\\bimplements\\s+${escapedSymbol}\\b`), kind: 'implements' },
      );
    }

    if (typeFilter === 'all' || typeFilter === 'variable') {
      patterns.push(
        { regex: new RegExp(`\\b(?:const|let|var)\\s+${escapedSymbol}\\b`), kind: 'declaration' },
      );
    }

    if (typeFilter === 'all' || typeFilter === 'type') {
      patterns.push(
        { regex: new RegExp(`\\b(?:interface|type)\\s+${escapedSymbol}\\b`), kind: 'type-def' },
        { regex: new RegExp(`:\\s*${escapedSymbol}\\b`), kind: 'type-usage' },
      );
    }

    // Also match imports/exports
    patterns.push(
      { regex: new RegExp(`\\bimport\\b.*\\b${escapedSymbol}\\b`), kind: 'import' },
      { regex: new RegExp(`\\bexport\\b.*\\b${escapedSymbol}\\b`), kind: 'export' },
    );

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      for (const { regex, kind } of patterns) {
        if (regex.test(line)) {
          results.push({
            file: relativePath,
            line: lineIdx + 1,
            kind,
            context: line.slice(0, 120),
          });
          break; // Only one match per line
        }
      }
    }
  }
}

/**
 * Find potentially dead code: exported symbols that are not imported anywhere.
 */
export class AstFindDeadCodeTool extends BaseTool {
  name = 'ast-find-dead-code';
  description = 'Find exported symbols that are not imported anywhere in the project. Helps identify dead code.';
  parameters = {
    type: 'object' as const,
    properties: {
      path: { type: 'string', description: 'Directory to search (relative to project root, defaults to "src")' },
    },
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const searchPath = safePath((params.path as string) || 'src');
      const root = getProjectRoot();

      // Phase 1: Collect all exports
      const exports = new Map<string, { file: string; line: number }>();
      // Phase 2: Collect all imports
      const imports = new Set<string>();

      const extensions = ['.ts', '.tsx', '.js', '.jsx'];
      const files: string[] = [];

      const walk = (d: string) => {
        let entries: fs.Dirent[];
        try {
          entries = fs.readdirSync(d, { withFileTypes: true });
        } catch {
          return;
        }
        for (const entry of entries) {
          if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue;
          const full = path.join(d, entry.name);
          if (entry.isDirectory()) walk(full);
          else if (extensions.some(ext => entry.name.endsWith(ext))) files.push(full);
        }
      };
      walk(searchPath);

      // Scan exports
      const exportRegex = /\bexport\s+(?:(?:default\s+)?(?:class|function|const|let|var|interface|type|enum)\s+)(\w+)/g;
      const namedExportRegex = /\bexport\s*\{([^}]+)\}/g;

      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');
        const relFile = file.replace(root + '/', '');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          let match;
          exportRegex.lastIndex = 0;
          while ((match = exportRegex.exec(line)) !== null) {
            exports.set(match[1], { file: relFile, line: i + 1 });
          }
          namedExportRegex.lastIndex = 0;
          while ((match = namedExportRegex.exec(line)) !== null) {
            const names = match[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0].trim());
            for (const name of names) {
              if (name) exports.set(name, { file: relFile, line: i + 1 });
            }
          }
        }
      }

      // Scan imports
      const importRegex = /\bimport\s+(?:(?:\{([^}]+)\})|(?:(\w+)))/g;

      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8');
        let match;
        importRegex.lastIndex = 0;
        while ((match = importRegex.exec(content)) !== null) {
          if (match[1]) {
            const names = match[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0].trim());
            for (const name of names) {
              if (name) imports.add(name);
            }
          }
          if (match[2]) {
            imports.add(match[2]);
          }
        }
      }

      // Find exports not in imports
      const deadCode: Array<{ symbol: string; file: string; line: number }> = [];
      for (const [symbol, loc] of exports) {
        if (!imports.has(symbol)) {
          deadCode.push({ symbol, ...loc });
        }
      }

      if (deadCode.length === 0) {
        return this.success('No potentially dead exports found.');
      }

      const output = deadCode
        .sort((a, b) => a.file.localeCompare(b.file))
        .map(d => `${d.file}:${d.line}  ${d.symbol}`)
        .join('\n');

      return this.success(
        `Found ${deadCode.length} potentially unused export(s):\n${output}`,
        { count: deadCode.length },
      );
    } catch (err) {
      return this.error(`Dead code search failed: ${(err as Error).message}`);
    }
  }
}

/**
 * Extract a code block into a new function (TS/JS only).
 * Reads a file, extracts the specified line range, wraps it in a function,
 * and replaces the original lines with a call to the new function.
 */
export class AstExtractFunctionTool extends BaseTool {
  name = 'ast-extract-function';
  description = 'Extract a range of lines from a file into a new named function. The original lines are replaced with a function call.';
  parameters = {
    type: 'object' as const,
    properties: {
      file: { type: 'string', description: 'File path (relative to project root)' },
      startLine: { type: 'number', description: 'First line to extract (1-based)' },
      endLine: { type: 'number', description: 'Last line to extract (1-based, inclusive)' },
      functionName: { type: 'string', description: 'Name for the new function' },
    },
    required: ['file', 'startLine', 'endLine', 'functionName'],
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const filePath = safePath(params.file as string);
      const startLine = params.startLine as number;
      const endLine = params.endLine as number;
      const functionName = params.functionName as string;

      if (!fs.existsSync(filePath)) {
        return this.error(`File not found: ${filePath}`);
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      if (startLine < 1 || endLine > lines.length || startLine > endLine) {
        return this.error(`Invalid line range: ${startLine}-${endLine} (file has ${lines.length} lines)`);
      }

      // Extract the lines
      const extracted = lines.slice(startLine - 1, endLine);
      const indent = extracted[0].match(/^(\s*)/)?.[1] || '';

      // Determine if async is needed
      const isAsync = extracted.some(l => /\bawait\b/.test(l));

      // Build the new function
      const fnLines = [
        `${indent}${isAsync ? 'async ' : ''}function ${functionName}() {`,
        ...extracted.map(l => `  ${l}`),
        `${indent}}`,
        '',
      ];

      // Replace original lines with function call
      const callLine = `${indent}${isAsync ? 'await ' : ''}${functionName}();`;
      const newLines = [
        ...lines.slice(0, startLine - 1),
        callLine,
        ...lines.slice(endLine),
      ];

      // Insert function definition just before the extraction point
      const insertPoint = startLine - 1;
      newLines.splice(insertPoint, 0, ...fnLines);

      fs.writeFileSync(filePath, newLines.join('\n'), 'utf-8');

      const root = getProjectRoot();
      const relPath = filePath.replace(root + '/', '');

      return this.success(
        `Extracted lines ${startLine}-${endLine} into function "${functionName}" in ${relPath}`,
        { functionName, isAsync, linesExtracted: endLine - startLine + 1 },
      );
    } catch (err) {
      return this.error(`Extract function failed: ${(err as Error).message}`);
    }
  }
}
