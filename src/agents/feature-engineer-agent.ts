import { IProvider } from '../providers/types.js';
import { BaseAgent } from './base-agent.js';
import { AgentContext } from './types.js';
import { buildFeatureEngineerSystemPrompt } from './prompts/feature-engineer-system.js';

export class FeatureEngineerAgent extends BaseAgent {
  name = 'feature-engineer';
  role = 'Feature Engineer';
  color = '#FBBF24';
  toolNames = [
    'file-read', 'file-search', 'file-glob', 'file-list',
    'shell-exec', 'git-diff', 'git-status',
    'code-analyze', 'code-find-symbol',
    'web-search', 'web-fetch',
    'test-run',
    'memory-load', 'memory-save',
  ];

  constructor(provider: IProvider, maxIterations?: number) {
    super(provider, maxIterations, { maxContextTokens: 90_000 });
  }

  buildSystemPrompt(context: AgentContext): string {
    return buildFeatureEngineerSystemPrompt(context);
  }

  parseOutput(content: string): unknown {
    const json = this.extractJsonBlock(content);
    if (json && typeof json === 'object') {
      const obj = json as Record<string, unknown>;

      return {
        score: typeof obj.score === 'number' ? obj.score : 0,
        summary: obj.summary || '',
        issues: Array.isArray(obj.issues)
          ? (obj.issues as Array<Record<string, unknown>>).map(issue => ({
              severity: issue.severity || 'medium',
              category: issue.category || 'correctness',
              file: issue.file || '',
              line: typeof issue.line === 'number' ? issue.line : undefined,
              description: issue.description || '',
              suggestion: issue.suggestion || '',
            }))
          : [],
        suggestions: Array.isArray(obj.suggestions)
          ? (obj.suggestions as Array<Record<string, unknown>>).map(s => ({
              category: s.category || 'improvement',
              file: s.file || '',
              description: s.description || '',
              priority: s.priority || 'medium',
            }))
          : [],
        approved: typeof obj.approved === 'boolean' ? obj.approved : false,
        blockers: Array.isArray(obj.blockers) ? obj.blockers : [],
      };
    }

    return {
      score: 0,
      summary: 'Review output could not be parsed',
      issues: [],
      suggestions: [],
      approved: false,
      blockers: ['Output parsing failed'],
    };
  }
}
