export enum PipelineStage {
  IDLE = 'idle',
  PLANNING = 'planning',
  BUILDING = 'building',
  TESTING = 'testing',
  DEBUGGING = 'debugging',
  REVIEWING = 'reviewing',
  COMPLETE = 'complete',
  FAILED = 'failed',
}

export interface StageDependency {
  stage: PipelineStage;
  dependsOn: PipelineStage[];
}

export interface StageOutput {
  stage: PipelineStage;
  success: boolean;
  content: string;
  structured?: unknown;
  duration: number; // ms
  tokensUsed: { input: number; output: number };
}

export interface PipelineState {
  currentStage: PipelineStage;
  task: string;
  mode: 'auto' | 'human';
  outputs: Map<PipelineStage, StageOutput>;
  retryCount: number;
  maxRetries: number;
  improvementPass: number;
  maxImprovementPasses: number;
  startTime: number;
  error?: string;
}

export interface PipelineOptions {
  task: string;
  mode: 'auto' | 'human';
  maxRetries?: number;
  stages?: PipelineStage[]; // Override which stages to run (for /plan, /build etc.)
  checkpointPath?: string;  // Resume from a checkpoint file
}

/** Role mapping from pipeline stage to config model role */
export const STAGE_ROLE_MAP: Record<string, 'planner' | 'builder' | 'tester' | 'debugger' | 'featureEngineer'> = {
  [PipelineStage.PLANNING]: 'planner',
  [PipelineStage.BUILDING]: 'builder',
  [PipelineStage.TESTING]: 'tester',
  [PipelineStage.DEBUGGING]: 'debugger',
  [PipelineStage.REVIEWING]: 'featureEngineer',
};

/** The default full pipeline DAG (dependency graph) */
export const DEFAULT_PIPELINE_DAG: StageDependency[] = [
  { stage: PipelineStage.PLANNING, dependsOn: [] },
  { stage: PipelineStage.BUILDING, dependsOn: [PipelineStage.PLANNING] },
  { stage: PipelineStage.TESTING, dependsOn: [PipelineStage.BUILDING] },
  { stage: PipelineStage.REVIEWING, dependsOn: [PipelineStage.TESTING] },
];

/** The default full pipeline stage order (flat, for backward compat) */
export const DEFAULT_PIPELINE_STAGES: PipelineStage[] = [
  PipelineStage.PLANNING,
  PipelineStage.BUILDING,
  PipelineStage.TESTING,
  PipelineStage.REVIEWING,
];
