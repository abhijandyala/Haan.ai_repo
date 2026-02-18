import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { BaseTool, ToolResult } from './types.js';
import { safePath, getProjectRoot, relativePath } from '../utils/path-utils.js';

export class CodeAnalyzeTool extends BaseTool {
  name = 'code-analyze';
  description = 'Analyze code structure of a file or project. Reads package.json, finds imports, and lists exports.';
  parameters = {
    type: 'object' as const,
    properties: {
      path: { type: 'string', description: 'File or directory path relative to project root' },
    },
    required: ['path'],
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const targetPath = safePath(params.path as string);
      const stat = fs.statSync(targetPath);

      if (stat.isDirectory()) {
        return this.analyzeDirectory(targetPath);
      } else {
        return this.analyzeFile(targetPath);
      }
    } catch (err) {
      return this.error(`Analysis failed: ${(err as Error).message}`);
    }
  }

  private analyzeDirectory(dirPath: string): ToolResult {
    const sections: string[] = [];

    // Check for package.json
    const pkgPath = path.join(dirPath, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        sections.push('=== package.json ===');
        sections.push(`Name: ${pkg.name || 'unnamed'}`);
        sections.push(`Version: ${pkg.version || 'unversioned'}`);
        if (pkg.description) sections.push(`Description: ${pkg.description}`);
        if (pkg.main) sections.push(`Main: ${pkg.main}`);
        if (pkg.scripts) {
          sections.push(`Scripts: ${Object.keys(pkg.scripts).join(', ')}`);
        }
        if (pkg.dependencies) {
          sections.push(`Dependencies (${Object.keys(pkg.dependencies).length}): ${Object.keys(pkg.dependencies).join(', ')}`);
        }
        if (pkg.devDependencies) {
          sections.push(`DevDependencies (${Object.keys(pkg.devDependencies).length}): ${Object.keys(pkg.devDependencies).join(', ')}`);
        }
      } catch {
        sections.push('package.json: failed to parse');
      }
    }

    // Check for tsconfig.json
    const tsconfigPath = path.join(dirPath, 'tsconfig.json');
    if (fs.existsSync(tsconfigPath)) {
      sections.push('\n=== tsconfig.json ===');
      sections.push('TypeScript project detected');
    }

    // List source files
    const srcDir = path.join(dirPath, 'src');
    if (fs.existsSync(srcDir)) {
      sections.push('\n=== Source Structure ===');
      const files = this.collectFiles(srcDir, ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs']);
      const root = getProjectRoot();
      for (const f of files.slice(0, 50)) {
        sections.push(f.replace(root + '/', ''));
      }
      if (files.length > 50) {
        sections.push(`... and ${files.length - 50} more files`);
      }
    }

    return this.success(sections.join('\n'));
  }

  private analyzeFile(filePath: string): ToolResult {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const sections: string[] = [];
    const rel = relativePath(filePath);

    sections.push(`=== ${rel} ===`);
    sections.push(`Lines: ${lines.length}`);

    // Find imports
    const imports: string[] = [];
    for (const line of lines) {
      const importMatch = line.match(/^import\s+.*from\s+['"](.+)['"]/);
      if (importMatch) {
        imports.push(importMatch[1]);
        continue;
      }
      const requireMatch = line.match(/require\s*\(\s*['"](.+)['"]\s*\)/);
      if (requireMatch) {
        imports.push(requireMatch[1]);
      }
    }
    if (imports.length > 0) {
      sections.push(`\nImports (${imports.length}):`);
      for (const imp of imports) {
        sections.push(`  ${imp}`);
      }
    }

    // Find exports
    const exports: string[] = [];
    for (const line of lines) {
      const exportMatch = line.match(/^export\s+(default\s+)?(class|function|const|let|var|interface|type|enum|abstract\s+class)\s+(\w+)/);
      if (exportMatch) {
        const kind = exportMatch[2];
        const name = exportMatch[3];
        exports.push(`${kind} ${name}`);
      }
    }
    if (exports.length > 0) {
      sections.push(`\nExports (${exports.length}):`);
      for (const exp of exports) {
        sections.push(`  ${exp}`);
      }
    }

    // Find classes and functions (non-exported too)
    const symbols: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const classMatch = line.match(/(?:abstract\s+)?class\s+(\w+)/);
      if (classMatch) {
        symbols.push(`class ${classMatch[1]} (line ${i + 1})`);
      }
      const funcMatch = line.match(/(?:async\s+)?function\s+(\w+)/);
      if (funcMatch) {
        symbols.push(`function ${funcMatch[1]} (line ${i + 1})`);
      }
    }
    if (symbols.length > 0) {
      sections.push(`\nSymbols (${symbols.length}):`);
      for (const sym of symbols) {
        sections.push(`  ${sym}`);
      }
    }

    return this.success(sections.join('\n'));
  }

  private collectFiles(dir: string, extensions: string[]): string[] {
    const results: string[] = [];
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
        if (entry.isDirectory()) {
          walk(full);
        } else {
          const ext = path.extname(entry.name);
          if (extensions.includes(ext)) {
            results.push(full);
          }
        }
      }
    };
    walk(dir);
    return results;
  }
}

export class CodeFindSymbolTool extends BaseTool {
  name = 'code-find-symbol';
  description = 'Search for symbol definitions (class, function, const, interface, type) across the codebase.';
  parameters = {
    type: 'object' as const,
    properties: {
      symbol: { type: 'string', description: 'Symbol name to search for' },
      path: { type: 'string', description: 'Directory to search in (relative to project root, defaults to "src")' },
    },
    required: ['symbol'],
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const symbol = params.symbol as string;
      const searchPath = safePath((params.path as string) || 'src');
      const root = getProjectRoot();

      // Pattern matches common definition forms
      const patterns = [
        `(class|interface|type|enum|function|const|let|var|abstract class)\\s+${symbol}\\b`,
        `def\\s+${symbol}\\s*\\(`,     // Python
        `func\\s+${symbol}\\s*\\(`,     // Go
        `fn\\s+${symbol}\\s*[(<]`,      // Rust
      ];
      const combinedPattern = patterns.join('|');

      let cmd: string;
      try {
        execSync('which rg', { stdio: 'pipe' });
        cmd = `rg --no-heading --line-number --max-count 50 -e '${combinedPattern}' '${searchPath}'`;
      } catch {
        cmd = `grep -rn --max-count=50 -E '${combinedPattern}' '${searchPath}'`;
      }

      try {
        const output = execSync(cmd, {
          encoding: 'utf-8',
          timeout: 10000,
          maxBuffer: 512 * 1024,
          cwd: root,
        }).trim();

        if (!output) {
          return this.success(`No definitions found for symbol: ${symbol}`);
        }

        const relativized = output
          .split('\n')
          .map((line) => line.replace(root + '/', ''))
          .join('\n');

        return this.success(relativized);
      } catch (execErr: unknown) {
        const exitErr = execErr as { status?: number };
        if (exitErr.status === 1) {
          return this.success(`No definitions found for symbol: ${symbol}`);
        }
        throw execErr;
      }
    } catch (err) {
      return this.error(`Symbol search failed: ${(err as Error).message}`);
    }
  }
}
