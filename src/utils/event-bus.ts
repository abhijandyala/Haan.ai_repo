import { EventEmitter } from 'events';

export interface HaanEvents {
  'agent:thinking': { agent: string; iteration: number };
  'agent:reasoning': { agent: string; text: string };
  'agent:idle': { agent: string };
  'agent:streaming': { agent: string; text: string };
  'agent:tool_call': { agent: string; tool: string; args: Record<string, unknown> };
  'agent:tool_result': { agent: string; tool: string; result: string; isError: boolean };
  'agent:complete': { agent: string; output: unknown };
  'agent:error': { agent: string; error: string };
  'pipeline:stage_start': { stage: string; agent: string };
  'pipeline:stage_complete': { stage: string; output: unknown };
  'pipeline:stage_error': { stage: string; error: string };
  'pipeline:approval_needed': { stage: string; summary: string; resolve: (approved: boolean) => void };
  'pipeline:complete': { success: boolean; summary: string };
  'pipeline:retry': { stage: string; attempt: number; maxRetries: number };
  'pipeline:improvement': { pass: number; score: number; issues: unknown[] };
  'pipeline:start': { task: string; mode: string };
  'pipeline:parallel_group': { stages: string[]; level: number };
  'pipeline:checkpoint': { stage: string; path: string };
  'pipeline:failover': { from: string; to: string; reason: string };
  'pipeline:validation_error': { stage: string; errors: string[] };
  'ui:message': { role: string; agent?: string; content: string };
  'ui:clear': {};
  'cost:update': { model: string; inputTokens: number; outputTokens: number; cost?: number };
}

class TypedEventBus extends EventEmitter {
  emit<K extends keyof HaanEvents>(event: K, data: HaanEvents[K]): boolean {
    return super.emit(event, data);
  }

  on<K extends keyof HaanEvents>(event: K, listener: (data: HaanEvents[K]) => void): this {
    return super.on(event, listener);
  }

  off<K extends keyof HaanEvents>(event: K, listener: (data: HaanEvents[K]) => void): this {
    return super.off(event, listener);
  }

  once<K extends keyof HaanEvents>(event: K, listener: (data: HaanEvents[K]) => void): this {
    return super.once(event, listener);
  }
}

export const eventBus = new TypedEventBus();
eventBus.setMaxListeners(50);
