import { describe, it, expect } from 'vitest';
import { validateStageOutput } from '../../src/pipeline/stage-schemas.js';
import { PipelineStage } from '../../src/pipeline/types.js';

describe('validateStageOutput', () => {
  describe('planner schema', () => {
    it('accepts valid planner output', () => {
      const result = validateStageOutput(PipelineStage.PLANNING, {
        steps: ['Step 1', 'Step 2'],
        risks: ['Risk A'],
      });
      expect(result.valid).toBe(true);
    });

    it('rejects planner output without steps', () => {
      const result = validateStageOutput(PipelineStage.PLANNING, {
        summary: 'No steps here',
      });
      expect(result.valid).toBe(false);
    });

    it('rejects empty steps array', () => {
      const result = validateStageOutput(PipelineStage.PLANNING, {
        steps: [],
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('builder schema', () => {
    it('accepts valid builder output', () => {
      const result = validateStageOutput(PipelineStage.BUILDING, {
        filesCreated: ['src/foo.ts'],
        filesModified: [],
        summary: 'Created foo',
      });
      expect(result.valid).toBe(true);
    });

    it('rejects builder output missing summary', () => {
      const result = validateStageOutput(PipelineStage.BUILDING, {
        filesCreated: ['src/foo.ts'],
        filesModified: [],
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('tester schema', () => {
    it('accepts valid tester output', () => {
      const result = validateStageOutput(PipelineStage.TESTING, {
        passed: 5,
        failed: 0,
        errors: [],
      });
      expect(result.valid).toBe(true);
    });

    it('accepts tester output with coverage', () => {
      const result = validateStageOutput(PipelineStage.TESTING, {
        passed: 3,
        failed: 2,
        errors: ['Error 1'],
        coverage: 75.5,
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('debugger schema', () => {
    it('accepts valid debugger output', () => {
      const result = validateStageOutput(PipelineStage.DEBUGGING, {
        rootCause: 'Missing null check',
        fix: 'Added null check on line 42',
        filesModified: ['src/utils.ts'],
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('reviewer schema', () => {
    it('accepts valid reviewer output', () => {
      const result = validateStageOutput(PipelineStage.REVIEWING, {
        score: 8,
        approved: true,
        issues: [],
        suggestions: [],
      });
      expect(result.valid).toBe(true);
    });

    it('rejects score out of range', () => {
      const result = validateStageOutput(PipelineStage.REVIEWING, {
        score: 15,
        approved: true,
      });
      expect(result.valid).toBe(false);
    });

    it('rejects negative score', () => {
      const result = validateStageOutput(PipelineStage.REVIEWING, {
        score: -1,
        approved: false,
      });
      expect(result.valid).toBe(false);
    });
  });

  it('returns valid for unknown stages', () => {
    const result = validateStageOutput(PipelineStage.IDLE, { anything: 'goes' });
    expect(result.valid).toBe(true);
  });

  it('returns invalid for null structured output', () => {
    const result = validateStageOutput(PipelineStage.BUILDING, null);
    expect(result.valid).toBe(false);
  });
});
