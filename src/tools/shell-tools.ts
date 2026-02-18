import { execSync, spawn } from 'child_process';
import { BaseTool, ToolResult } from './types.js';
import { safePath, getProjectRoot } from '../utils/path-utils.js';
import { logger } from '../utils/logger.js';
import { getConfig } from '../config/config-manager.js';

const MAX_OUTPUT = 30000;
const DEFAULT_TIMEOUT = 60000;

// Commands that are too dangerous to run
const BLOCKED_PATTERNS = [
  /\brm\s+(-rf?|--recursive)\s+[\/~]/i,
  /\bmkfs\b/i,
  /\bdd\s+.*of=\/dev\//i,
  /\b:(){ :|:& };:/,
  /\bfork\s*bomb/i,
];

export class ShellExecTool extends BaseTool {
  name = 'shell-exec';
  description = 'Execute a shell command and return stdout and stderr. Default timeout is 60 seconds. Output is truncated to 30000 characters. Dangerous commands (rm -rf /, mkfs, etc.) are blocked.';
  parameters = {
    type: 'object' as const,
    properties: {
      command: { type: 'string', description: 'Shell command to execute' },
      cwd: { type: 'string', description: 'Working directory (relative to project root, defaults to project root)' },
      timeout: { type: 'number', description: 'Timeout in milliseconds (default 60000)' },
    },
    required: ['command'],
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const command = params.command as string;
    const timeout = Math.min((params.timeout as number) || DEFAULT_TIMEOUT, 300000);
    let cwd: string;

    try {
      cwd = params.cwd ? safePath(params.cwd as string) : getProjectRoot();
    } catch (err) {
      return this.error(`Invalid working directory: ${(err as Error).message}`);
    }

    // Safety check (skipped with --dangerously-skip-permissions)
    if (!getConfig().dangerouslySkipPermissions) {
      for (const pattern of BLOCKED_PATTERNS) {
        if (pattern.test(command)) {
          return this.error(`Command blocked for safety: "${command}". Use --dangerously-skip-permissions to bypass.`);
        }
      }
    }

    logger.info('shell-exec', `Running: ${command}`, { cwd, timeout });

    try {
      const output = execSync(command, {
        cwd,
        encoding: 'utf-8',
        timeout,
        maxBuffer: 5 * 1024 * 1024,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
      });

      const formatted = this.formatOutput(output, command);
      return this.success(formatted, {
        command,
        exitCode: 0,
        outputLength: output.length,
        truncated: output.length > MAX_OUTPUT,
      });
    } catch (err: unknown) {
      const execErr = err as {
        status?: number | null;
        stdout?: string | Buffer;
        stderr?: string | Buffer;
        message?: string;
        killed?: boolean;
      };

      // Command ran but returned non-zero exit code
      if (execErr.status !== undefined && execErr.status !== null) {
        const stdout = (execErr.stdout || '').toString();
        const stderr = (execErr.stderr || '').toString();

        let combined = '';
        if (stdout) combined += stdout;
        if (stderr) {
          if (combined) combined += '\n--- stderr ---\n';
          combined += stderr;
        }

        const formatted = this.formatOutput(combined, command);
        return this.error(`Exit code ${execErr.status}:\n${formatted}`);
      }

      // Timeout
      if (execErr.killed) {
        return this.error(`Command timed out after ${timeout}ms: "${command}"`);
      }

      return this.error(`Command failed: ${execErr.message || String(err)}`);
    }
  }

  private formatOutput(output: string, command: string): string {
    if (!output || !output.trim()) {
      return '(no output)';
    }

    let result = output;

    // Strip ANSI escape sequences
    result = result.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
    result = result.replace(/\x1B\][^\x07]*\x07/g, '');

    // Truncate if needed, keeping both head and tail
    if (result.length > MAX_OUTPUT) {
      const headSize = Math.floor(MAX_OUTPUT * 0.7);
      const tailSize = MAX_OUTPUT - headSize - 100;
      const head = result.slice(0, headSize);
      const tail = result.slice(-tailSize);
      result = `${head}\n\n... [${result.length - headSize - tailSize} characters omitted] ...\n\n${tail}`;
    }

    return result;
  }
}
