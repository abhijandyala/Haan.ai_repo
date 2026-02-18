import { z } from 'zod';
import { PipelineStage } from './types.js';
import { logger } from '../utils/logger.js';

// ── Per-stage output schemas ──────────────────────

const PlannerSchema = z.object({
  steps: z.array(z.string()).min(1),
  risks: z.array(z.string()).optional(),
  dependencies: z.array(z.string()).optional(),
  summary: z.string().optional(),
}).passthrough();

const BuilderSchema = z.object({
  filesCreated: z.array(z.string()),
  filesModified: z.array(z.string()),
  summary: z.string(),
}).passthrough();

const TesterSchema = z.object({
  passed: z.number(),
  failed: z.number(),
  errors: z.array(z.string()),
  coverage: z.number().optional(),
  testFiles: z.array(z.string()).optional(),
}).passthrough();

const DebuggerSchema = z.object({
  rootCause: z.string(),
  fix: z.string(),
  filesModified: z.array(z.string()),
}).passthrough();

const ReviewerSchema = z.object({
  score: z.number().min(0).max(10),
  approved: z.boolean(),
  issues: z.array(z.object({
    severity: z.string(),
    file: z.string(),
    description: z.string(),
    suggestion: z.string().optional(),
  }).passthrough()).optional(),
  suggestions: z.array(z.object({
    priority: z.string(),
    file: z.string(),
    description: z.string(),
  }).passthrough()).optional(),
  blockers: z.array(z.string()).optional(),
}).passthrough();

const STAGE_SCHEMAS: Partial<Record<PipelineStage, z.ZodTypeAny>> = {
  [PipelineStage.PLANNING]: PlannerSchema,
  [PipelineStage.BUILDING]: BuilderSchema,
  [PipelineStage.TESTING]: TesterSchema,
  [PipelineStage.DEBUGGING]: DebuggerSchema,
  [PipelineStage.REVIEWING]: ReviewerSchema,
};

/**
 * Validate structured output from a stage against its schema.
 * Returns { valid: true, data } on success, or { valid: false, errors } on failure.
 */
export function validateStageOutput(
  stage: PipelineStage,
  structured: unknown,
): { valid: true; data: unknown } | { valid: false; errors: string[] } {
  const schema = STAGE_SCHEMAS[stage];
  if (!schema) {
    // No schema for this stage — pass through
    return { valid: true, data: structured };
  }

  if (structured == null) {
    return {
      valid: false,
      errors: [`Stage ${stage} returned no structured output (expected JSON matching schema)`],
    };
  }

  const result = schema.safeParse(structured);
  if (result.success) {
    return { valid: true, data: result.data };
  }

  const errors = result.error.issues.map(
    issue => `${issue.path.join('.')}: ${issue.message}`,
  );
  logger.warn('stage-schemas', `Validation failed for ${stage}`, { errors });
  return { valid: false, errors };
}
