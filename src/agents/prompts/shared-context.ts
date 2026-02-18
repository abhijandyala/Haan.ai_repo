import { AgentContext } from '../types.js';
import { formatFrameworkInfo } from '../framework-detector.js';

export function buildProjectContext(context: AgentContext): string {
  const lines: string[] = [];

  lines.push('## Project Information');
  lines.push(`Working directory: ${context.projectRoot}`);
  if (context.projectInfo) {
    lines.push(context.projectInfo);
  }

  // Include detected framework info
  if (context.framework) {
    const fwInfo = formatFrameworkInfo(context.framework);
    if (fwInfo) {
      lines.push('');
      lines.push('## Detected Technology Stack');
      lines.push(fwInfo);
    }
  }
  lines.push('');

  if (Object.keys(context.previousOutputs).length > 0) {
    lines.push('## Previous Pipeline Stage Outputs');
    for (const [stage, output] of Object.entries(context.previousOutputs)) {
      lines.push(`### ${stage}`);
      if (typeof output === 'string') {
        lines.push(output.slice(0, 300));
      } else {
        const obj = output as Record<string, unknown>;
        lines.push(`Status: ${obj.success ? 'passed' : 'FAILED'}`);
        // Prefer structured data (compact) over raw content (huge)
        const structured = obj.structured;
        if (structured) {
          try {
            lines.push(JSON.stringify(structured).slice(0, 500));
          } catch {
            lines.push(String(structured).slice(0, 300));
          }
        } else {
          lines.push(String(obj.content || '').slice(0, 300));
        }
      }
      lines.push('');
    }
  }

  if (Object.keys(context.workingMemory).length > 0) {
    lines.push('## Working Memory');
    for (const [key, value] of Object.entries(context.workingMemory)) {
      lines.push(`### ${key}`);
      try {
        lines.push(typeof value === 'string' ? value : JSON.stringify(value, null, 2));
      } catch {
        lines.push(String(value));
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

export function buildToolGuidance(toolNames: string[]): string {
  const toolDescriptions: Record<string, string> = {
    'file-read': 'Read file contents. Use to examine source code, configs, and documentation.',
    'file-write': 'Create or overwrite a file. Provide the full file path and complete content.',
    'file-edit': 'Apply targeted edits to an existing file using search/replace pairs. Preferred over file-write for partial changes.',
    'file-delete': 'Delete a file from the filesystem. Use with caution.',
    'file-search': 'Search for text patterns across files using ripgrep-style regex.',
    'file-glob': 'Find files matching a glob pattern (e.g., **/*.ts).',
    'file-list': 'List files and directories at a given path.',
    'shell-exec': 'Execute a shell command. Use for build commands, installs, running scripts, etc.',
    'git-status': 'Show git working tree status (modified, staged, untracked files).',
    'git-diff': 'Show git diff of changes (staged or unstaged).',
    'git-log': 'Show recent git commit history.',
    'git-commit': 'Stage files and create a git commit.',
    'git-branch': 'List, create, or checkout branches.',
    'git-push': 'Push commits to a remote repository.',
    'web-search': 'Search the web for documentation, examples, or solutions.',
    'web-fetch': 'Fetch content from a specific URL.',
    'code-analyze': 'Analyze code structure: extract imports, exports, classes, functions from a file.',
    'code-find-symbol': 'Search for symbol definitions (class, function, const, interface, type) across the codebase.',
    'test-discover': 'Discover test files in the project.',
    'test-run': 'Run the project test suite or specific test files.',
    'test-parse': 'Parse test output to extract structured pass/fail results.',
    'memory-load': 'Load data from the shared working memory store.',
    'memory-save': 'Save data to the shared working memory store for other agents to use.',
    'memory-search': 'Search memories by keyword across keys, content, and tags.',
  };

  const lines: string[] = ['## Available Tools'];
  for (const name of toolNames) {
    const desc = toolDescriptions[name] || `Tool: ${name}`;
    lines.push(`- **${name}**: ${desc}`);
  }
  lines.push('');
  lines.push('## Tool Usage Guidelines');
  lines.push('- Read files before modifying them to understand existing code.');
  lines.push('- Use file-edit for targeted changes rather than rewriting entire files.');
  lines.push('- Use file-search and file-glob to discover relevant code before making changes.');
  lines.push('- Use shell-exec to run build/lint/test commands and verify your changes work.');
  lines.push('- Always check git-status or git-diff to understand what has changed.');
  lines.push('- Save important findings to memory so other agents can use them.');
  lines.push('');

  return lines.join('\n');
}

export function buildOutputFormatInstructions(format: string): string {
  return [
    '## Output Format',
    'When you have completed your work and have no more tool calls to make, provide your final response.',
    'Your final response MUST contain a JSON block wrapped in ```json fences.',
    '',
    'Expected JSON structure:',
    '```',
    format,
    '```',
    '',
    'Include any additional commentary or explanation outside the JSON block.',
    'The JSON block is machine-parsed, so ensure it is valid JSON.',
    '',
  ].join('\n');
}
