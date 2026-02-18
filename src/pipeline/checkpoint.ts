import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { PipelineStage, PipelineState, StageOutput } from './types.js';
import { haanSubDir } from '../utils/path-utils.js';
import { logger } from '../utils/logger.js';

export interface CheckpointData {
  task: string;
  mode: 'auto' | 'human';
  completedStages: string[];
  outputs: Record<string, CheckpointStageOutput>;
  retryCount: number;
  improvementPass: number;
  maxRetries: number;
  maxImprovementPasses: number;
  timestamp: number;
}

interface CheckpointStageOutput {
  stage: string;
  success: boolean;
  content: string;
  structured?: unknown;
  duration: number;
  tokensUsed: { input: number; output: number };
}

/**
 * Generate a deterministic hash for a task string (used as checkpoint filename).
 */
function taskHash(task: string): string {
  return crypto.createHash('sha256').update(task).digest('hex').slice(0, 16);
}

/**
 * Get the checkpoints directory, creating it if needed.
 */
function getCheckpointDir(): string {
  const dir = haanSubDir('checkpoints');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Save a pipeline checkpoint to disk.
 */
export function saveCheckpoint(state: PipelineState): string {
  const dir = getCheckpointDir();
  const filename = `${taskHash(state.task)}.json`;
  const filepath = path.join(dir, filename);

  const completedStages: string[] = [];
  const outputs: Record<string, CheckpointStageOutput> = {};

  for (const [stage, output] of state.outputs) {
    completedStages.push(stage);
    outputs[stage] = {
      stage: output.stage,
      success: output.success,
      content: output.content,
      structured: output.structured,
      duration: output.duration,
      tokensUsed: output.tokensUsed,
    };
  }

  const data: CheckpointData = {
    task: state.task,
    mode: state.mode,
    completedStages,
    outputs,
    retryCount: state.retryCount,
    improvementPass: state.improvementPass,
    maxRetries: state.maxRetries,
    maxImprovementPasses: state.maxImprovementPasses,
    timestamp: Date.now(),
  };

  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
  logger.info('checkpoint', `Saved checkpoint: ${filepath}`);
  return filepath;
}

/**
 * Load a checkpoint from disk.
 * Returns null if not found or invalid.
 */
export function loadCheckpoint(taskOrPath: string): CheckpointData | null {
  let filepath: string;

  if (fs.existsSync(taskOrPath)) {
    filepath = taskOrPath;
  } else {
    const dir = getCheckpointDir();
    filepath = path.join(dir, `${taskHash(taskOrPath)}.json`);
  }

  if (!fs.existsSync(filepath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(filepath, 'utf-8');
    return JSON.parse(raw) as CheckpointData;
  } catch (err) {
    logger.warn('checkpoint', `Failed to load checkpoint: ${filepath}`, err);
    return null;
  }
}

/**
 * Restore a PipelineState from checkpoint data.
 */
export function restoreFromCheckpoint(data: CheckpointData): {
  state: Partial<PipelineState>;
  completedStages: PipelineStage[];
  outputs: Map<PipelineStage, StageOutput>;
} {
  const outputs = new Map<PipelineStage, StageOutput>();
  const completedStages: PipelineStage[] = [];

  for (const [stageStr, output] of Object.entries(data.outputs)) {
    const stage = stageStr as PipelineStage;
    completedStages.push(stage);
    outputs.set(stage, {
      stage,
      success: output.success,
      content: output.content,
      structured: output.structured,
      duration: output.duration,
      tokensUsed: output.tokensUsed,
    });
  }

  return {
    state: {
      task: data.task,
      mode: data.mode,
      retryCount: data.retryCount,
      improvementPass: data.improvementPass,
      maxRetries: data.maxRetries,
      maxImprovementPasses: data.maxImprovementPasses,
    },
    completedStages,
    outputs,
  };
}

/**
 * Remove a checkpoint after successful completion.
 */
export function removeCheckpoint(task: string): void {
  const dir = getCheckpointDir();
  const filepath = path.join(dir, `${taskHash(task)}.json`);
  try {
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      logger.debug('checkpoint', `Removed checkpoint: ${filepath}`);
    }
  } catch {
    // ignore
  }
}

/**
 * List all available checkpoints.
 */
export function listCheckpoints(): CheckpointData[] {
  const dir = getCheckpointDir();
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  const checkpoints: CheckpointData[] = [];

  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
      checkpoints.push(JSON.parse(raw) as CheckpointData);
    } catch {
      // skip invalid
    }
  }

  return checkpoints.sort((a, b) => b.timestamp - a.timestamp);
}
