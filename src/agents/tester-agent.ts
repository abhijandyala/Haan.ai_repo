import { IProvider } from '../providers/types.js';
import { BaseAgent } from './base-agent.js';
import { AgentContext } from './types.js';
import { buildTesterSystemPrompt } from './prompts/tester-system.js';

export class TesterAgent extends BaseAgent {
  name = 'tester';
  role = 'Tester';
  color = '#60A5FA';
  toolNames = [
    'file-read', 'file-write', 'file-search', 'file-list',
    'shell-exec', 'test-discover', 'test-run', 'test-parse', 'test-coverage',
    'git-diff', 'memory-load',
  ];

  constructor(provider: IProvider, maxIterations?: number) {
    super(provider, maxIterations, { maxContextTokens: 80_000 });
  }

  buildSystemPrompt(context: AgentContext): string {
    return buildTesterSystemPrompt(context);
  }

  parseOutput(content: string): unknown {
    const json = this.extractJsonBlock(content);
    if (json && typeof json === 'object') {
      const obj = json as Record<string, unknown>;
      const testResults = obj.testResults as Record<string, unknown> | undefined;

      return {
        testsWritten: Array.isArray(obj.testsWritten) ? obj.testsWritten : [],
        testResults: {
          passed: Number(testResults?.passed ?? 0),
          failed: Number(testResults?.failed ?? 0),
          skipped: Number(testResults?.skipped ?? 0),
          total: Number(testResults?.total ?? 0),
          failures: Array.isArray(testResults?.failures)
            ? (testResults.failures as Array<Record<string, unknown>>).map(f => ({
                test: f.test || '',
                file: f.file || '',
                error: f.error || '',
                severity: f.severity || 'medium',
              }))
            : [],
        },
        coverageNotes: obj.coverageNotes || '',
        summary: obj.summary || '',
      };
    }

    return {
      testsWritten: [],
      testResults: {
        passed: 0,
        failed: 0,
        skipped: 0,
        total: 0,
        failures: [],
      },
      coverageNotes: '',
      summary: 'Test output could not be parsed',
    };
  }
}
