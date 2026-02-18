import { describe, it, expect, beforeEach } from 'vitest';
import { PromptOptimizer } from '../../src/agents/prompt-optimizer.js';
import fs from 'fs';
import path from 'path';
import { getProjectRoot } from '../../src/utils/path-utils.js';

describe('PromptOptimizer', () => {
  let optimizer: PromptOptimizer;

  beforeEach(() => {
    // Delete metrics file to ensure clean state
    const metricsPath = path.join(getProjectRoot(), '.haan', 'prompt-metrics.json');
    if (fs.existsSync(metricsPath)) {
      fs.unlinkSync(metricsPath);
    }
    optimizer = new PromptOptimizer();
  });

  it('should register and select variants', () => {
    optimizer.registerVariant('builder', 'v1', 'Concise', 'Be concise');
    optimizer.registerVariant('builder', 'v2', 'Detailed', 'Be detailed');

    const selected = optimizer.selectVariant('builder');
    expect(selected).not.toBeNull();
    expect(['v1', 'v2']).toContain(selected!.id);
  });

  it('should return null for unknown agent', () => {
    const result = optimizer.selectVariant('nonexistent');
    expect(result).toBeNull();
  });

  it('should track outcomes', () => {
    optimizer.registerVariant('tester', 'a', 'Variant A', 'content a');
    optimizer.registerVariant('tester', 'b', 'Variant B', 'content b');

    // Record many successes for A, failures for B
    for (let i = 0; i < 20; i++) {
      optimizer.recordOutcome('tester', 'a', true);
      optimizer.recordOutcome('tester', 'b', false);
    }

    const metrics = optimizer.getMetrics();
    const metricA = metrics.find(m => m.id === 'a')!;
    const metricB = metrics.find(m => m.id === 'b')!;

    expect(metricA.winRate).toBeGreaterThan(0.8);
    expect(metricB.winRate).toBeLessThan(0.2);
  });

  it('should converge on better variant after many selections', () => {
    optimizer.registerVariant('builder', 'good', 'Good', 'good prompt');
    optimizer.registerVariant('builder', 'bad', 'Bad', 'bad prompt');

    // Simulate: 'good' always succeeds, 'bad' always fails
    for (let i = 0; i < 50; i++) {
      optimizer.recordOutcome('builder', 'good', true);
      optimizer.recordOutcome('builder', 'bad', false);
    }

    // After strong signal, Thompson sampling should heavily favor 'good'
    let goodCount = 0;
    for (let i = 0; i < 100; i++) {
      const selected = optimizer.selectVariant('builder');
      if (selected?.id === 'good') goodCount++;
    }

    // Should select 'good' at least 90% of the time
    expect(goodCount).toBeGreaterThan(85);
  });

  it('should return single variant when only one exists', () => {
    optimizer.registerVariant('debugger', 'only', 'Only One', 'content');
    const result = optimizer.selectVariant('debugger');
    expect(result!.id).toBe('only');
  });
});
