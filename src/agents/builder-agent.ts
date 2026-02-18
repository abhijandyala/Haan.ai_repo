import { IProvider } from '../providers/types.js';
import { BaseAgent } from './base-agent.js';
import { AgentContext } from './types.js';
import { buildBuilderSystemPrompt } from './prompts/builder-system.js';

export class BuilderAgent extends BaseAgent {
  name = 'builder';
  role = 'Builder';
  color = '#34D399';
  toolNames = [
    'file-read', 'file-write', 'file-edit', 'file-delete',
    'file-search', 'file-glob', 'file-list',
    'shell-exec', 'git-diff', 'code-analyze',
    'ast-find-symbol', 'ast-find-dead-code', 'ast-extract-function',
    'memory-load', 'memory-save',
  ];

  constructor(provider: IProvider, maxIterations?: number) {
    super(provider, maxIterations, { maxContextTokens: 120_000, enableReflection: true });
  }

  buildSystemPrompt(context: AgentContext): string {
    return buildBuilderSystemPrompt(context);
  }

  parseOutput(content: string): unknown {
    const json = this.extractJsonBlock(content);
    if (json && typeof json === 'object') {
      const obj = json as Record<string, unknown>;
      return {
        filesCreated: Array.isArray(obj.filesCreated) ? obj.filesCreated : [],
        filesModified: Array.isArray(obj.filesModified) ? obj.filesModified : [],
        filesDeleted: Array.isArray(obj.filesDeleted) ? obj.filesDeleted : [],
        buildSuccess: typeof obj.buildSuccess === 'boolean' ? obj.buildSuccess : true,
        summary: obj.summary || '',
        notes: obj.notes || '',
      };
    }

    return {
      filesCreated: [],
      filesModified: [],
      filesDeleted: [],
      buildSuccess: false,
      summary: 'Build output could not be parsed',
      notes: content.substring(0, 500),
    };
  }
}
