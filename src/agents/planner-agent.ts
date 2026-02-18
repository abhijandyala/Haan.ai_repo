import { IProvider } from '../providers/types.js';
import { BaseAgent } from './base-agent.js';
import { AgentContext } from './types.js';
import { buildPlannerSystemPrompt } from './prompts/planner-system.js';

export class PlannerAgent extends BaseAgent {
  name = 'planner';
  role = 'Planner';
  color = '#A78BFA';
  toolNames = [
    'file-read', 'file-search', 'file-glob', 'file-list',
    'shell-exec', 'git-status', 'git-log',
    'web-search', 'web-fetch', 'code-analyze', 'memory-load',
  ];

  constructor(provider: IProvider, maxIterations?: number) {
    super(provider, maxIterations, { maxContextTokens: 60_000 });
  }

  buildSystemPrompt(context: AgentContext): string {
    return buildPlannerSystemPrompt(context);
  }

  parseOutput(content: string): unknown {
    const json = this.extractJsonBlock(content);
    if (json && typeof json === 'object') {
      const obj = json as Record<string, unknown>;
      // Validate expected plan structure
      if (obj.steps && Array.isArray(obj.steps)) {
        return {
          summary: obj.summary || '',
          steps: (obj.steps as Array<Record<string, unknown>>).map((step, i) => ({
            id: step.id ?? i + 1,
            action: step.action || 'modify',
            file: step.file || '',
            description: step.description || '',
            details: step.details || '',
            dependencies: step.dependencies || [],
            risk: step.risk || 'low',
          })),
          risks: obj.risks || [],
          notes: obj.notes || '',
        };
      }
    }

    // Return a minimal plan if parsing fails
    return {
      summary: 'Plan could not be parsed from agent output',
      steps: [],
      risks: ['Output parsing failed - raw content returned'],
      notes: content.substring(0, 500),
    };
  }
}
