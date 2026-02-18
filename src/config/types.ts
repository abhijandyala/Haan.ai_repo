export interface McpServerConfig {
  name: string;
  transport: 'stdio' | 'sse';
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
}

export interface HaanConfig {
  mode: 'auto' | 'human';
  dangerouslySkipPermissions: boolean;
  autoApprove: boolean;
  models: {
    planner: string;
    builder: string;
    tester: string;
    debugger: string;
    featureEngineer: string;
  };
  providers: {
    anthropic: { apiKey: string; fallbacks?: string[] };
    openai: { apiKey: string; fallbacks?: string[] };
    google: { apiKey: string; fallbacks?: string[] };
  };
  pipeline: {
    maxRetries: number;
    maxImprovementPasses: number;  // max review→fix cycles
    maxAgentIterations: number;
    timeout: number;  // ms per stage
  };
  ui: {
    showTokens: boolean;
    showCost: boolean;
    streamingSpeed: number;  // ms between chars
    theme: 'default' | 'minimal';
  };
  mcp?: {
    servers: McpServerConfig[];
  };
  plugins?: {
    enabled: boolean;
    directories?: string[];
  };
  api?: {
    port: number;
    auth?: {
      enabled: boolean;
      apiKeys?: string[];
    };
  };
  budget?: {
    dailyLimit?: number;
    perTaskLimit?: number;
  };
  cache?: {
    enabled: boolean;
    ttlMinutes: number;
    maxSizeMB: number;
  };
}
