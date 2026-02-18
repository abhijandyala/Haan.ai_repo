import { IProvider } from '../providers/types.js';
import { BaseAgent } from './base-agent.js';
import { AgentContext } from './types.js';
import { buildDebuggerSystemPrompt } from './prompts/debugger-system.js';

export class DebuggerAgent extends BaseAgent {
  name = 'debugger';
  role = 'Debugger';
  color = '#F87171';
  toolNames = [
    'file-read', 'file-write', 'file-edit', 'file-search', 'file-glob', 'file-list',
    'shell-exec', 'git-diff', 'git-log',
    'code-analyze', 'code-find-symbol',
    'test-run',
    'web-search',
    'memory-load',
  ];

  constructor(provider: IProvider, maxIterations?: number) {
    super(provider, maxIterations, { maxContextTokens: 100_000, enableReflection: true });
  }

  buildSystemPrompt(context: AgentContext): string {
    return buildDebuggerSystemPrompt(context);
  }

  parseOutput(content: string): unknown {
    const json = this.extractJsonBlock(content);
    if (json && typeof json === 'object') {
      const obj = json as Record<string, unknown>;
      const testResults = obj.testResults as Record<string, unknown> | undefined;

      return {
        fixes: Array.isArray(obj.fixes)
          ? (obj.fixes as Array<Record<string, unknown>>).map(f => ({
              file: f.file || '',
              description: f.description || '',
              rootCause: f.rootCause || '',
              linesChanged: Number(f.linesChanged ?? 0),
              relatedFailures: Array.isArray(f.relatedFailures) ? f.relatedFailures : [],
            }))
          : [],
        unfixed: Array.isArray(obj.unfixed)
          ? (obj.unfixed as Array<Record<string, unknown>>).map(u => ({
              test: u.test || '',
              reason: u.reason || '',
            }))
          : [],
        confidence: typeof obj.confidence === 'number' ? obj.confidence : 0,
        testResults: testResults ? {
          passed: Number(testResults.passed ?? 0),
          failed: Number(testResults.failed ?? 0),
          total: Number(testResults.total ?? 0),
        } : undefined,
        summary: obj.summary || '',
      };
    }

    return {
      fixes: [],
      unfixed: [],
      confidence: 0,
      summary: 'Debugger output could not be parsed',
    };
  }
}
