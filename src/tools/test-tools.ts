import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { BaseTool, ToolResult } from './types.js';
import { safePath, getProjectRoot } from '../utils/path-utils.js';
import { logger } from '../utils/logger.js';

export class TestDiscoverTool extends BaseTool {
  name = 'test-discover';
  description = 'Find test files in the project.';
  parameters = {
    type: 'object' as const,
    properties: {
      path: { type: 'string', description: 'Directory to search (relative to project root, defaults to ".")' },
    },
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const searchPath = safePath((params.path as string) || '.');
      const testFiles = this.findTestFiles(searchPath);
      const root = getProjectRoot();

      if (testFiles.length === 0) {
        return this.success('No test files found.');
      }

      const relative = testFiles.map((f) => f.replace(root + '/', ''));
      return this.success(relative.join('\n'), { count: testFiles.length });
    } catch (err) {
      return this.error(`Test discovery failed: ${(err as Error).message}`);
    }
  }

  private findTestFiles(dir: string): string[] {
    const results: string[] = [];
    const testPatterns = [
      /\.test\.\w+$/,
      /\.spec\.\w+$/,
      /_test\.\w+$/,
      /test_.*\.\w+$/,
    ];

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
          // Include __tests__ and test directories
          walk(full);
        } else {
          const matchesPattern = testPatterns.some((p) => p.test(entry.name));
          const inTestDir = full.includes('/test/') || full.includes('/__tests__/') || full.includes('/tests/');
          if (matchesPattern || inTestDir) {
            results.push(full);
          }
        }
      }
    };

    walk(dir);
    return results.sort();
  }
}

export class TestRunTool extends BaseTool {
  name = 'test-run';
  description = 'Run the test suite. Auto-detects the test runner if no command is specified.';
  parameters = {
    type: 'object' as const,
    properties: {
      command: { type: 'string', description: 'Explicit test command to run (overrides auto-detection)' },
      path: { type: 'string', description: 'Path to specific test file or directory' },
    },
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const root = getProjectRoot();
      let command = params.command as string | undefined;
      const testPath = params.path ? safePath(params.path as string) : undefined;

      if (!command) {
        command = this.detectTestCommand(root, testPath) ?? undefined;
        if (!command) {
          return this.error(
            'Could not auto-detect test command. No test runner found. Specify a command explicitly.'
          );
        }
      }

      logger.info('test-run', `Running: ${command}`);

      try {
        const output = execSync(command, {
          cwd: root,
          encoding: 'utf-8',
          timeout: 120000,
          maxBuffer: 2 * 1024 * 1024,
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, FORCE_COLOR: '0', CI: 'true' },
        });

        const trimmed = output.length > 10000
          ? output.slice(0, 10000) + '\n...[output truncated]'
          : output;

        return this.success(trimmed, { command, exitCode: 0 });
      } catch (execErr: unknown) {
        const err = execErr as { status?: number; stdout?: string; stderr?: string };
        const stdout = (err.stdout || '').toString();
        const stderr = (err.stderr || '').toString();
        let combined = stdout;
        if (stderr) combined += (combined ? '\n' : '') + stderr;

        const trimmed = combined.length > 10000
          ? combined.slice(0, 10000) + '\n...[output truncated]'
          : combined;

        return this.error(`Tests failed (exit code ${err.status}):\n${trimmed}`);
      }
    } catch (err) {
      return this.error(`Test run failed: ${(err as Error).message}`);
    }
  }

  private detectTestCommand(root: string, testPath?: string): string | null {
    const suffix = testPath ? ` ${testPath}` : '';

    // Check for package.json scripts
    const pkgPath = path.join(root, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        if (pkg.scripts?.test && pkg.scripts.test !== 'echo "Error: no test specified" && exit 1') {
          return `npm test${suffix ? ' --' + suffix : ''}`;
        }
      } catch {
        // ignore
      }

      // Check for vitest
      if (fs.existsSync(path.join(root, 'vitest.config.ts')) || fs.existsSync(path.join(root, 'vitest.config.js'))) {
        return `npx vitest run${suffix}`;
      }

      // Check for jest
      if (fs.existsSync(path.join(root, 'jest.config.ts')) || fs.existsSync(path.join(root, 'jest.config.js'))) {
        return `npx jest${suffix}`;
      }
    }

    // Check for pytest
    if (fs.existsSync(path.join(root, 'pytest.ini')) || fs.existsSync(path.join(root, 'setup.py')) || fs.existsSync(path.join(root, 'pyproject.toml'))) {
      return `pytest${suffix}`;
    }

    // Check for Go
    if (fs.existsSync(path.join(root, 'go.mod'))) {
      return `go test${suffix || ' ./...'}`;
    }

    // Check for Cargo (Rust)
    if (fs.existsSync(path.join(root, 'Cargo.toml'))) {
      return `cargo test${suffix}`;
    }

    return null;
  }
}

export class TestParseTool extends BaseTool {
  name = 'test-parse';
  description = 'Parse test output to extract pass/fail counts and summary.';
  parameters = {
    type: 'object' as const,
    properties: {
      output: { type: 'string', description: 'Raw test output to parse' },
    },
    required: ['output'],
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const output = params.output as string;
      const result = this.parseTestOutput(output);
      return this.success(JSON.stringify(result, null, 2), result);
    } catch (err) {
      return this.error(`Parse failed: ${(err as Error).message}`);
    }
  }

  private parseTestOutput(output: string): Record<string, unknown> {
    const result: Record<string, unknown> = {
      passed: 0,
      failed: 0,
      skipped: 0,
      total: 0,
      errors: [] as string[],
      summary: '',
    };

    // Jest / Vitest patterns
    const jestSummary = output.match(/Tests:\s+(\d+)\s+failed.*?(\d+)\s+passed.*?(\d+)\s+total/);
    if (jestSummary) {
      result.failed = parseInt(jestSummary[1]);
      result.passed = parseInt(jestSummary[2]);
      result.total = parseInt(jestSummary[3]);
      result.summary = jestSummary[0];
      return result;
    }

    const jestPass = output.match(/Tests:\s+(\d+)\s+passed,\s+(\d+)\s+total/);
    if (jestPass) {
      result.passed = parseInt(jestPass[1]);
      result.total = parseInt(jestPass[2]);
      result.summary = jestPass[0];
      return result;
    }

    // Pytest pattern
    const pytestMatch = output.match(/(\d+)\s+passed(?:,\s+(\d+)\s+failed)?(?:,\s+(\d+)\s+skipped)?/);
    if (pytestMatch) {
      result.passed = parseInt(pytestMatch[1]);
      result.failed = parseInt(pytestMatch[2] || '0');
      result.skipped = parseInt(pytestMatch[3] || '0');
      result.total = (result.passed as number) + (result.failed as number) + (result.skipped as number);
      result.summary = pytestMatch[0];
      return result;
    }

    // Go test pattern
    const goPass = output.match(/ok\s+\S+/g);
    const goFail = output.match(/FAIL\s+\S+/g);
    if (goPass || goFail) {
      result.passed = goPass ? goPass.length : 0;
      result.failed = goFail ? goFail.length : 0;
      result.total = (result.passed as number) + (result.failed as number);
      result.summary = `Go: ${result.passed} passed, ${result.failed} failed`;
      return result;
    }

    // Generic: count pass/fail lines
    const lines = output.split('\n');
    let passed = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const line of lines) {
      if (/\bpass(ed)?\b/i.test(line) && /\b(test|spec|it)\b/i.test(line)) passed++;
      if (/\bfail(ed)?\b/i.test(line) && /\b(test|spec|it)\b/i.test(line)) {
        failed++;
        errors.push(line.trim());
      }
    }

    result.passed = passed;
    result.failed = failed;
    result.total = passed + failed;
    result.errors = errors;
    result.summary = `${passed} passed, ${failed} failed out of ${passed + failed}`;

    return result;
  }
}

export class TestCoverageTool extends BaseTool {
  name = 'test-coverage';
  description = 'Run tests with coverage and return uncovered lines. Supports vitest, jest, pytest, and go test.';
  parameters = {
    type: 'object' as const,
    properties: {
      testCommand: {
        type: 'string',
        description: 'The test command to run with coverage (e.g., "npx vitest run --coverage"). If omitted, auto-detects.',
      },
      path: {
        type: 'string',
        description: 'Focus coverage on a specific path/module.',
      },
    },
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const root = getProjectRoot();
      let command = params.testCommand as string | undefined;

      if (!command) {
        command = this.detectCoverageCommand(root) ?? undefined;
      }

      if (!command) {
        return this.error('Could not detect test framework. Provide a testCommand explicitly.');
      }

      logger.info('test-coverage', `Running coverage: ${command}`);

      let output: string;
      try {
        output = execSync(command, {
          cwd: root,
          encoding: 'utf-8',
          timeout: 120_000,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      } catch (err) {
        // Tests may fail but still produce coverage output
        const execErr = err as { stdout?: string; stderr?: string; message: string };
        output = (execErr.stdout || '') + '\n' + (execErr.stderr || '');
        if (!output.includes('coverage') && !output.includes('Coverage') && !output.includes('%')) {
          return this.error(`Coverage command failed: ${execErr.message}\n${output.slice(0, 1000)}`);
        }
      }

      // Truncate output if huge
      const truncated = output.length > 15_000
        ? output.slice(0, 15_000) + '\n\n[Output truncated]'
        : output;

      return this.success(truncated, {
        command,
        outputLength: output.length,
      });
    } catch (err) {
      return this.error(`Coverage failed: ${(err as Error).message}`);
    }
  }

  private detectCoverageCommand(root: string): string | null {
    const pkgPath = path.join(root, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };

        if (deps.vitest) return 'npx vitest run --coverage --reporter=verbose 2>&1';
        if (deps.jest) return 'npx jest --coverage --verbose 2>&1';
      } catch { /* ignore */ }
      return null;
    }

    if (fs.existsSync(path.join(root, 'pyproject.toml')) ||
        fs.existsSync(path.join(root, 'requirements.txt'))) {
      return 'python -m pytest --cov=. --cov-report=term-missing 2>&1';
    }

    if (fs.existsSync(path.join(root, 'go.mod'))) {
      return 'go test -cover ./... 2>&1';
    }

    return null;
  }
}
