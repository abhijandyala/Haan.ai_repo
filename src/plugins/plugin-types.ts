import { BaseTool } from '../tools/types.js';
import { BaseAgent } from '../agents/base-agent.js';
import { IProvider } from '../providers/types.js';
import { MemoryManager } from '../memory/memory-manager.js';

/**
 * Plugin manifest — defined in each plugin's `plugin.json`.
 */
export interface PluginManifest {
  name: string;
  version: string;
  description?: string;
  author?: string;
  tools?: string[];
  agents?: string[];
  stages?: string[];
  hooks?: {
    onInit?: string;
    onBeforeStage?: string;
    onAfterStage?: string;
    onToolCall?: string;
    onComplete?: string;
  };
  entry: string;
}

/**
 * A loaded plugin instance with its resolved entry module.
 */
export interface LoadedPlugin {
  manifest: PluginManifest;
  path: string;
  module: PluginModule;
}

/**
 * The interface a plugin's entry module must export.
 */
export interface PluginModule {
  activate(api: HaanPluginAPI): void | Promise<void>;
  deactivate?(): void | Promise<void>;
}

/**
 * Factory for creating agents from plugins.
 */
export type AgentFactory = (provider: IProvider, maxIterations: number) => BaseAgent;

/**
 * Configuration for a custom pipeline stage added by a plugin.
 */
export interface StageConfig {
  /** Human-readable label */
  label: string;
  /** Agent name to use for this stage */
  agentName: string;
  /** Stages this custom stage depends on */
  dependsOn?: string[];
}

/**
 * The API surface exposed to plugins. Plugins use this to register
 * tools, agents, stages, and subscribe to lifecycle events.
 */
export interface HaanPluginAPI {
  /** Register a tool that becomes available to all agents */
  registerTool(tool: BaseTool): void;

  /** Register an agent factory under a name */
  registerAgent(name: string, factory: AgentFactory): void;

  /** Register a custom pipeline stage */
  registerStage(name: string, config: StageConfig): void;

  /** Subscribe to a lifecycle event */
  on(event: string, handler: (...args: unknown[]) => void): void;

  /** Get the project configuration */
  getConfig(): Record<string, unknown>;

  /** Get the memory manager */
  getMemory(): MemoryManager;
}
