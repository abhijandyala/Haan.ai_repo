import { ProjectFramework } from './framework-detector.js';

export interface AgentContext {
  projectRoot: string;
  projectInfo: string;
  workingMemory: Record<string, unknown>;
  previousOutputs: Record<string, unknown>;
  mode: 'auto' | 'human';
  framework?: ProjectFramework;
}

export interface AgentOutput {
  success: boolean;
  content: string;
  structured?: unknown;
  toolCallsMade: number;
  tokensUsed: { input: number; output: number };
}

export type AgentEventType = 'thinking' | 'streaming' | 'tool_call' | 'tool_result' | 'complete' | 'error';
