import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { saveCheckpoint, loadCheckpoint, restoreFromCheckpoint, removeCheckpoint, listCheckpoints } from '../../src/pipeline/checkpoint.js';
import { PipelineStage, PipelineState, StageOutput } from '../../src/pipeline/types.js';

// Use a temp directory for tests
const testDir = path.join(os.tmpdir(), 'haan-test-checkpoints');

describe('Checkpoint System', () => {
  // We can't easily redirect haanSubDir in tests without mocking,
  // so we test the core serialization logic via restoreFromCheckpoint

  it('restores pipeline state from checkpoint data', () => {
    const data = {
      task: 'Test task',
      mode: 'auto' as const,
      completedStages: ['planning', 'building'],
      outputs: {
        planning: {
          stage: 'planning',
          success: true,
          content: 'Plan done',
          structured: { steps: ['step1'] },
          duration: 1000,
          tokensUsed: { input: 100, output: 200 },
        },
        building: {
          stage: 'building',
          success: true,
          content: 'Build done',
          structured: { filesCreated: ['foo.ts'], filesModified: [], summary: 'done' },
          duration: 2000,
          tokensUsed: { input: 300, output: 400 },
        },
      },
      retryCount: 0,
      improvementPass: 0,
      maxRetries: 3,
      maxImprovementPasses: 2,
      timestamp: Date.now(),
    };

    const restored = restoreFromCheckpoint(data);

    expect(restored.completedStages).toContain(PipelineStage.PLANNING);
    expect(restored.completedStages).toContain(PipelineStage.BUILDING);
    expect(restored.outputs.size).toBe(2);
    expect(restored.outputs.get(PipelineStage.PLANNING)?.success).toBe(true);
    expect(restored.outputs.get(PipelineStage.BUILDING)?.content).toBe('Build done');
    expect(restored.state.retryCount).toBe(0);
    expect(restored.state.task).toBe('Test task');
  });

  it('handles checkpoint with failed stages', () => {
    const data = {
      task: 'Failing task',
      mode: 'human' as const,
      completedStages: ['planning', 'building', 'testing'],
      outputs: {
        planning: {
          stage: 'planning',
          success: true,
          content: 'Plan done',
          duration: 500,
          tokensUsed: { input: 50, output: 100 },
        },
        building: {
          stage: 'building',
          success: true,
          content: 'Build done',
          duration: 1500,
          tokensUsed: { input: 200, output: 300 },
        },
        testing: {
          stage: 'testing',
          success: false,
          content: '3 tests failed',
          duration: 800,
          tokensUsed: { input: 100, output: 150 },
        },
      },
      retryCount: 1,
      improvementPass: 0,
      maxRetries: 3,
      maxImprovementPasses: 2,
      timestamp: Date.now(),
    };

    const restored = restoreFromCheckpoint(data);

    expect(restored.completedStages).toHaveLength(3);
    expect(restored.outputs.get(PipelineStage.TESTING)?.success).toBe(false);
    expect(restored.state.retryCount).toBe(1);
    expect(restored.state.mode).toBe('human');
  });
});
