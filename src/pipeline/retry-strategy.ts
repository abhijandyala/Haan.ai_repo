import { PipelineState } from './types.js';

const MAX_BACKOFF_MS = 30_000;

/**
 * Determine if the pipeline should retry after a stage failure.
 */
export function shouldRetry(state: PipelineState): boolean {
  return state.retryCount < state.maxRetries;
}

/**
 * Exponential backoff: 1000 * 2^attempt, capped at 30s.
 */
export function getBackoffMs(attempt: number): number {
  const ms = 1000 * Math.pow(2, attempt);
  return Math.min(ms, MAX_BACKOFF_MS);
}

/**
 * Sleep for the given number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
