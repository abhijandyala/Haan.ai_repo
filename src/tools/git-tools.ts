import { execSync } from 'child_process';
import { BaseTool, ToolResult } from './types.js';
import { getProjectRoot } from '../utils/path-utils.js';

function git(args: string): string {
  return execSync(`git ${args}`, {
    cwd: getProjectRoot(),
    encoding: 'utf-8',
    timeout: 15000,
    maxBuffer: 1024 * 1024,
  }).trim();
}

export class GitStatusTool extends BaseTool {
  name = 'git-status';
  description = 'Show the working tree status (staged, modified, untracked files).';
  parameters = {
    type: 'object' as const,
    properties: {},
  };

  async execute(): Promise<ToolResult> {
    try {
      const status = git('status');
      const short = git('status --short');
      return this.success(`${status}\n\nShort:\n${short}`);
    } catch (err) {
      return this.error(`git status failed: ${(err as Error).message}`);
    }
  }
}

export class GitDiffTool extends BaseTool {
  name = 'git-diff';
  description = 'Show changes between commits, working tree, etc.';
  parameters = {
    type: 'object' as const,
    properties: {
      staged: { type: 'boolean', description: 'Show staged changes (--cached)' },
      file: { type: 'string', description: 'Specific file to diff' },
    },
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      let cmd = 'diff';
      if (params.staged) cmd += ' --cached';
      if (params.file) cmd += ` -- '${String(params.file).replace(/'/g, "'\\''")}'`;

      const diff = git(cmd);
      if (!diff) {
        return this.success('No changes.');
      }
      // Truncate large diffs
      const maxLen = 15000;
      const output = diff.length > maxLen
        ? diff.slice(0, maxLen) + `\n...[diff truncated, ${diff.length} total chars]`
        : diff;
      return this.success(output);
    } catch (err) {
      return this.error(`git diff failed: ${(err as Error).message}`);
    }
  }
}

export class GitCommitTool extends BaseTool {
  name = 'git-commit';
  description = 'Stage files and create a git commit.';
  parameters = {
    type: 'object' as const,
    properties: {
      message: { type: 'string', description: 'Commit message' },
      files: {
        type: 'array',
        items: { type: 'string' },
        description: 'Files to stage before committing. If omitted, commits currently staged files.',
      },
    },
    required: ['message'],
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const message = params.message as string;
      const files = params.files as string[] | undefined;

      if (files && files.length > 0) {
        const fileList = files.map((f) => `'${String(f).replace(/'/g, "'\\''")}'`).join(' ');
        git(`add ${fileList}`);
      }

      // Check if there's anything to commit
      try {
        git('diff --cached --quiet');
        return this.error('Nothing to commit (no staged changes).');
      } catch {
        // Non-zero exit means there ARE staged changes, which is what we want
      }

      const escapedMessage = message.replace(/'/g, "'\\''");
      const result = git(`commit -m '${escapedMessage}'`);
      return this.success(result);
    } catch (err) {
      return this.error(`git commit failed: ${(err as Error).message}`);
    }
  }
}

export class GitBranchTool extends BaseTool {
  name = 'git-branch';
  description = 'List branches or create/checkout a branch.';
  parameters = {
    type: 'object' as const,
    properties: {
      name: { type: 'string', description: 'Branch name to create. Omit to list branches.' },
      checkout: { type: 'boolean', description: 'If true, checkout the branch after creating (or checkout existing)' },
    },
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const name = params.name as string | undefined;
      const checkout = (params.checkout as boolean) || false;

      if (!name) {
        const branches = git('branch -a');
        return this.success(branches);
      }

      if (checkout) {
        // Check if branch exists
        try {
          git(`rev-parse --verify ${name}`);
          // Branch exists, just checkout
          const result = git(`checkout ${name}`);
          return this.success(`Switched to branch: ${name}\n${result}`);
        } catch {
          // Branch doesn't exist, create and checkout
          const result = git(`checkout -b ${name}`);
          return this.success(`Created and switched to branch: ${name}\n${result}`);
        }
      } else {
        const result = git(`branch ${name}`);
        return this.success(`Created branch: ${name}\n${result}`);
      }
    } catch (err) {
      return this.error(`git branch failed: ${(err as Error).message}`);
    }
  }
}

export class GitPushTool extends BaseTool {
  name = 'git-push';
  description = 'Push commits to a remote repository.';
  parameters = {
    type: 'object' as const,
    properties: {
      remote: { type: 'string', description: 'Remote name (default "origin")' },
      branch: { type: 'string', description: 'Branch name (defaults to current branch)' },
      setUpstream: { type: 'boolean', description: 'Set upstream tracking (-u flag)' },
    },
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const remote = (params.remote as string) || 'origin';
      const setUpstream = (params.setUpstream as boolean) || false;
      let branch = params.branch as string | undefined;

      if (!branch) {
        branch = git('rev-parse --abbrev-ref HEAD');
      }

      let cmd = `push ${remote} ${branch}`;
      if (setUpstream) cmd = `push -u ${remote} ${branch}`;

      const result = git(cmd);
      return this.success(result || `Pushed to ${remote}/${branch}`);
    } catch (err) {
      return this.error(`git push failed: ${(err as Error).message}`);
    }
  }
}

export class GitLogTool extends BaseTool {
  name = 'git-log';
  description = 'Show commit log.';
  parameters = {
    type: 'object' as const,
    properties: {
      count: { type: 'number', description: 'Number of commits to show (default 10)' },
      file: { type: 'string', description: 'Show log for specific file' },
    },
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const count = (params.count as number) || 10;
      let cmd = `log --oneline --no-decorate -n ${count}`;
      if (params.file) cmd += ` -- '${String(params.file).replace(/'/g, "'\\''")}'`;

      const log = git(cmd);
      if (!log) {
        return this.success('No commits found.');
      }
      return this.success(log);
    } catch (err) {
      return this.error(`git log failed: ${(err as Error).message}`);
    }
  }
}
