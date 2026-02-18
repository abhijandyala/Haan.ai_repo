import { IProvider } from '../providers/types.js';
import { createProviderForRole } from '../providers/provider-factory.js';
import { getConfig } from '../config/config-manager.js';
import { BaseAgent } from './base-agent.js';
import { PlannerAgent } from './planner-agent.js';
import { BuilderAgent } from './builder-agent.js';
import { TesterAgent } from './tester-agent.js';
import { DebuggerAgent } from './debugger-agent.js';
import { FeatureEngineerAgent } from './feature-engineer-agent.js';

export type AgentName = 'planner' | 'builder' | 'tester' | 'debugger' | 'feature-engineer' | (string & {});

interface AgentFactory {
  (provider: IProvider, maxIterations: number): BaseAgent;
}

const AGENT_FACTORIES: Record<string, AgentFactory> = {
  'planner': (provider, maxIter) => new PlannerAgent(provider, maxIter),
  'builder': (provider, maxIter) => new BuilderAgent(provider, maxIter),
  'tester': (provider, maxIter) => new TesterAgent(provider, maxIter),
  'debugger': (provider, maxIter) => new DebuggerAgent(provider, maxIter),
  'feature-engineer': (provider, maxIter) => new FeatureEngineerAgent(provider, maxIter),
};

const ROLE_MAP: Record<AgentName, 'planner' | 'builder' | 'tester' | 'debugger' | 'featureEngineer'> = {
  'planner': 'planner',
  'builder': 'builder',
  'tester': 'tester',
  'debugger': 'debugger',
  'feature-engineer': 'featureEngineer',
};

/**
 * Create an agent by name, auto-selecting the appropriate provider
 * based on configuration.
 */
export function createAgent(name: AgentName): BaseAgent {
  const factory = AGENT_FACTORIES[name];
  if (!factory) {
    throw new Error(`Unknown agent: ${name}. Available agents: ${Object.keys(AGENT_FACTORIES).join(', ')}`);
  }

  const config = getConfig();
  const role = ROLE_MAP[name];
  const provider = createProviderForRole(role);
  const maxIterations = config.pipeline.maxAgentIterations;

  return factory(provider, maxIterations);
}

/**
 * Create an agent with a specific provider (useful for testing
 * or overriding the default provider).
 */
export function createAgentWithProvider(name: AgentName, provider: IProvider, maxIterations?: number): BaseAgent {
  const factory = AGENT_FACTORIES[name];
  if (!factory) {
    throw new Error(`Unknown agent: ${name}. Available agents: ${Object.keys(AGENT_FACTORIES).join(', ')}`);
  }

  const config = getConfig();
  return factory(provider, maxIterations ?? config.pipeline.maxAgentIterations);
}

/**
 * Get all registered agent names.
 */
export function getAgentNames(): AgentName[] {
  return Object.keys(AGENT_FACTORIES) as AgentName[];
}

/**
 * Check if an agent name is valid.
 */
export function isValidAgent(name: string): name is AgentName {
  return name in AGENT_FACTORIES;
}

/**
 * Register a custom agent factory (used by plugins).
 */
export function registerAgentFactory(name: string, factory: AgentFactory): void {
  AGENT_FACTORIES[name] = factory;
}

/**
 * Get a list of all agent names including plugin-registered ones.
 */
export function getAllAgentNames(): string[] {
  return Object.keys(AGENT_FACTORIES);
}
