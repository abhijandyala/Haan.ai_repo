import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { BaseTool, ToolResult } from './types.js';
import { safePath, getProjectRoot, relativePath } from '../utils/path-utils.js';
import { logger } from '../utils/logger.js';

export class FileReadTool extends BaseTool {
  name = 'file-read';
  description = 'Read the contents of a file. Optionally specify a line range.';
  parameters = {
    type: 'object' as const,
    properties: {
      path: { type: 'string', description: 'File path relative to project root' },
      startLine: { type: 'number', description: 'Starting line number (1-based)' },
      endLine: { type: 'number', description: 'Ending line number (1-based, inclusive)' },
    },
    required: ['path'],
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const filePath = safePath(params.path as string);
      if (!fs.existsSync(filePath)) {
        return this.error(`File not found: ${params.path}`);
      }
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        return this.error(`Path is a directory, not a file: ${params.path}`);
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      const startLine = params.startLine != null ? (params.startLine as number) : 1;
      const endLine = params.endLine != null ? (params.endLine as number) : lines.length;
      const start = Math.max(1, startLine) - 1;
      const end = Math.min(lines.length, endLine);

      const selected = lines.slice(start, end);
      const numbered = selected.map((line, i) => `${start + i + 1}\t${line}`).join('\n');

      return this.success(numbered, {
        path: relativePath(filePath),
        totalLines: lines.length,
        shownLines: selected.length,
      });
    } catch (err) {
      return this.error(`Failed to read file: ${(err as Error).message}`);
    }
  }
}

export class FileWriteTool extends BaseTool {
  name = 'file-write';
  description = 'Write content to a file. Creates the file and any parent directories if they do not exist.';
  parameters = {
    type: 'object' as const,
    properties: {
      path: { type: 'string', description: 'File path relative to project root' },
      content: { type: 'string', description: 'Content to write to the file' },
    },
    required: ['path', 'content'],
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const filePath = safePath(params.path as string);
      const content = params.content as string;

      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      const existed = fs.existsSync(filePath);
      fs.writeFileSync(filePath, content, 'utf-8');

      const lines = content.split('\n').length;
      const action = existed ? 'Updated' : 'Created';
      return this.success(`${action} ${params.path} (${lines} lines)`, {
        path: relativePath(filePath),
        lines,
        action: action.toLowerCase(),
      });
    } catch (err) {
      return this.error(`Failed to write file: ${(err as Error).message}`);
    }
  }
}

export class FileEditTool extends BaseTool {
  name = 'file-edit';
  description = 'Edit a file by replacing an exact text match with new text.';
  parameters = {
    type: 'object' as const,
    properties: {
      path: { type: 'string', description: 'File path relative to project root' },
      oldText: { type: 'string', description: 'Exact text to find and replace' },
      newText: { type: 'string', description: 'Replacement text' },
    },
    required: ['path', 'oldText', 'newText'],
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const filePath = safePath(params.path as string);
      if (!fs.existsSync(filePath)) {
        return this.error(`File not found: ${params.path}`);
      }

      const oldText = params.oldText as string;
      const newText = params.newText as string;
      const content = fs.readFileSync(filePath, 'utf-8');

      const occurrences = content.split(oldText).length - 1;
      if (occurrences === 0) {
        return this.error(`Text not found in ${params.path}. Make sure the oldText matches exactly (including whitespace and indentation).`);
      }
      if (occurrences > 1) {
        return this.error(`Found ${occurrences} occurrences of the text in ${params.path}. The oldText must be unique. Include more surrounding context to make it unique.`);
      }

      const updated = content.replace(oldText, newText);
      fs.writeFileSync(filePath, updated, 'utf-8');

      return this.success(`Edited ${params.path}: replaced 1 occurrence`, {
        path: relativePath(filePath),
      });
    } catch (err) {
      return this.error(`Failed to edit file: ${(err as Error).message}`);
    }
  }
}

export class FileDeleteTool extends BaseTool {
  name = 'file-delete';
  description = 'Delete a file.';
  parameters = {
    type: 'object' as const,
    properties: {
      path: { type: 'string', description: 'File path relative to project root' },
    },
    required: ['path'],
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const filePath = safePath(params.path as string);
      if (!fs.existsSync(filePath)) {
        return this.error(`File not found: ${params.path}`);
      }
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        return this.error(`Path is a directory, not a file: ${params.path}. Use shell-exec for directory removal.`);
      }

      fs.unlinkSync(filePath);
      return this.success(`Deleted ${params.path}`, { path: relativePath(filePath) });
    } catch (err) {
      return this.error(`Failed to delete file: ${(err as Error).message}`);
    }
  }
}

export class FileSearchTool extends BaseTool {
  name = 'file-search';
  description = 'Search for a text pattern in files using grep. Returns matching lines with file paths and line numbers.';
  parameters = {
    type: 'object' as const,
    properties: {
      pattern: { type: 'string', description: 'Search pattern (regex supported)' },
      path: { type: 'string', description: 'Directory or file to search in (relative to project root, defaults to ".")' },
      glob: { type: 'string', description: 'File glob pattern to filter, e.g. "*.ts"' },
    },
    required: ['pattern'],
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const searchPath = safePath((params.path as string) || '.');
      const pattern = params.pattern as string;
      const glob = params.glob as string | undefined;

      let cmd: string;
      // Try ripgrep first, fall back to grep
      const useRg = (() => {
        try {
          execSync('which rg', { stdio: 'pipe' });
          return true;
        } catch {
          return false;
        }
      })();

      const escapeShell = (s: string) => s.replace(/'/g, "'\\''");

      if (useRg) {
        cmd = `rg --no-heading --line-number --max-count 100 --max-columns 200`;
        if (glob) {
          cmd += ` --glob '${escapeShell(glob)}'`;
        }
        cmd += ` -- '${escapeShell(pattern)}'`;
        cmd += ` '${escapeShell(searchPath)}'`;
      } else {
        cmd = `grep -rn --max-count=100`;
        if (glob) {
          cmd += ` --include='${escapeShell(glob)}'`;
        }
        cmd += ` -- '${escapeShell(pattern)}'`;
        cmd += ` '${escapeShell(searchPath)}'`;
      }

      try {
        const output = execSync(cmd, {
          encoding: 'utf-8',
          timeout: 15000,
          maxBuffer: 1024 * 1024,
          cwd: getProjectRoot(),
        }).trim();

        if (!output) {
          return this.success('No matches found.');
        }

        // Relativize paths in output
        const root = getProjectRoot();
        const relativized = output
          .split('\n')
          .map((line) => line.replace(root + '/', ''))
          .join('\n');

        const matchCount = relativized.split('\n').length;
        return this.success(relativized, { matchCount });
      } catch (execErr: unknown) {
        const exitErr = execErr as { status?: number; stdout?: string };
        // grep returns exit code 1 for no matches
        if (exitErr.status === 1) {
          return this.success('No matches found.');
        }
        throw execErr;
      }
    } catch (err) {
      return this.error(`Search failed: ${(err as Error).message}`);
    }
  }
}

export class FileGlobTool extends BaseTool {
  name = 'file-glob';
  description = 'Find files matching a glob pattern. Returns a list of matching file paths.';
  parameters = {
    type: 'object' as const,
    properties: {
      pattern: { type: 'string', description: 'Glob pattern, e.g. "**/*.ts" or "src/**/*.test.ts"' },
      path: { type: 'string', description: 'Base directory to search from (relative to project root, defaults to ".")' },
    },
    required: ['pattern'],
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const basePath = safePath((params.path as string) || '.');
      const pattern = params.pattern as string;

      const matches = this.walkAndMatch(basePath, pattern);
      const root = getProjectRoot();
      const relativePaths = matches.map((m) => m.replace(root + '/', '')).sort();

      if (relativePaths.length === 0) {
        return this.success('No files found matching the pattern.');
      }

      const output = relativePaths.join('\n');
      return this.success(output, { count: relativePaths.length });
    } catch (err) {
      return this.error(`Glob failed: ${(err as Error).message}`);
    }
  }

  private walkAndMatch(dir: string, pattern: string): string[] {
    const results: string[] = [];
    const root = getProjectRoot();

    // Convert glob to regex
    const regexStr = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '<<<GLOBSTAR>>>')
      .replace(/\*/g, '[^/]*')
      .replace(/<<<GLOBSTAR>>>/g, '.*')
      .replace(/\?/g, '[^/]');
    const regex = new RegExp(`^${regexStr}$`);

    const walk = (currentDir: string): void => {
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(currentDir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        // Skip hidden directories, node_modules, dist, .git
        if (entry.isDirectory()) {
          if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') {
            continue;
          }
          walk(fullPath);
        } else {
          const relToBase = path.relative(dir, fullPath);
          if (regex.test(relToBase)) {
            results.push(fullPath);
          }
        }
      }
    };

    walk(dir);
    return results;
  }
}

export class FileListTool extends BaseTool {
  name = 'file-list';
  description = 'List the contents of a directory.';
  parameters = {
    type: 'object' as const,
    properties: {
      path: { type: 'string', description: 'Directory path relative to project root' },
      recursive: { type: 'boolean', description: 'List recursively (default false)' },
    },
    required: ['path'],
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const dirPath = safePath(params.path as string);
      if (!fs.existsSync(dirPath)) {
        return this.error(`Directory not found: ${params.path}`);
      }
      const stat = fs.statSync(dirPath);
      if (!stat.isDirectory()) {
        return this.error(`Path is a file, not a directory: ${params.path}`);
      }

      const recursive = (params.recursive as boolean) || false;
      const entries = this.listDir(dirPath, recursive);
      const root = getProjectRoot();
      const lines = entries.map((e) => {
        const rel = e.fullPath.replace(root + '/', '');
        return `${e.isDir ? 'd' : 'f'} ${rel}`;
      });

      if (lines.length === 0) {
        return this.success('Directory is empty.');
      }

      return this.success(lines.join('\n'), { count: lines.length });
    } catch (err) {
      return this.error(`Failed to list directory: ${(err as Error).message}`);
    }
  }

  private listDir(dir: string, recursive: boolean): { fullPath: string; isDir: boolean }[] {
    const results: { fullPath: string; isDir: boolean }[] = [];
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return results;
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') {
        continue;
      }
      const fullPath = path.join(dir, entry.name);
      const isDir = entry.isDirectory();
      results.push({ fullPath, isDir });
      if (isDir && recursive) {
        results.push(...this.listDir(fullPath, true));
      }
    }
    return results;
  }
}
