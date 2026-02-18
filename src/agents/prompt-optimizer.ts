import fs from 'fs';
import path from 'path';
import { getProjectRoot } from '../utils/path-utils.js';
import { logger } from '../utils/logger.js';

/**
 * A prompt variant with its tracked success metrics.
 */
interface PromptVariant {
  id: string;
  agentName: string;
  label: string;
  /** The prompt modifier or template fragment */
  content: string;
  /** Thompson sampling parameters: alpha = successes + 1, beta = failures + 1 */
  alpha: number;
  beta: number;
  /** Total number of times this variant was used */
  uses: number;
}

/**
 * Persisted metrics store for prompt A/B testing.
 * Stored at `.haan/prompt-metrics.json`.
 */
interface MetricsStore {
  variants: PromptVariant[];
  lastUpdated: string;
}

/**
 * PromptOptimizer tracks prompt variant success rates using Thompson sampling
 * (Beta distribution) to automatically converge on better prompts.
 *
 * Usage:
 *   1. Register variants with registerVariant()
 *   2. Before each agent run, call selectVariant(agentName) to pick a variant
 *   3. After the run, call recordOutcome() with success/failure
 *   4. Over time, the system converges on the best-performing variant
 */
export class PromptOptimizer {
  private variants: Map<string, PromptVariant> = new Map();
  private metricsPath: string;

  constructor() {
    const root = getProjectRoot();
    this.metricsPath = path.join(root, '.haan', 'prompt-metrics.json');
    this.loadMetrics();
  }

  /**
   * Register a prompt variant for an agent.
   */
  registerVariant(agentName: string, id: string, label: string, content: string): void {
    const key = `${agentName}:${id}`;
    if (!this.variants.has(key)) {
      this.variants.set(key, {
        id,
        agentName,
        label,
        content,
        alpha: 1, // Prior: 1 success
        beta: 1,  // Prior: 1 failure (uniform prior)
        uses: 0,
      });
    }
  }

  /**
   * Select the best variant for an agent using Thompson sampling.
   * Draws from each variant's Beta(alpha, beta) distribution and picks
   * the one with the highest sample.
   */
  selectVariant(agentName: string): PromptVariant | null {
    const candidates = Array.from(this.variants.values())
      .filter(v => v.agentName === agentName);

    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];

    // Thompson sampling: draw from Beta distribution for each variant
    let bestSample = -1;
    let bestVariant: PromptVariant | null = null;

    for (const variant of candidates) {
      const sample = this.sampleBeta(variant.alpha, variant.beta);
      if (sample > bestSample) {
        bestSample = sample;
        bestVariant = variant;
      }
    }

    if (bestVariant) {
      bestVariant.uses++;
      logger.debug('prompt-optimizer', `Selected variant "${bestVariant.label}" for ${agentName} (sample: ${bestSample.toFixed(3)})`);
    }

    return bestVariant;
  }

  /**
   * Record the outcome of a prompt variant usage.
   */
  recordOutcome(agentName: string, variantId: string, success: boolean): void {
    const key = `${agentName}:${variantId}`;
    const variant = this.variants.get(key);
    if (!variant) return;

    if (success) {
      variant.alpha++;
    } else {
      variant.beta++;
    }

    const winRate = ((variant.alpha - 1) / (variant.alpha + variant.beta - 2) * 100).toFixed(1);
    logger.debug('prompt-optimizer', `Variant "${variant.label}": ${success ? 'success' : 'failure'} (win rate: ${winRate}%)`);

    this.saveMetrics();
  }

  /**
   * Get metrics summary for all variants.
   */
  getMetrics(): Array<{
    agentName: string;
    id: string;
    label: string;
    uses: number;
    winRate: number;
    alpha: number;
    beta: number;
  }> {
    return Array.from(this.variants.values()).map(v => ({
      agentName: v.agentName,
      id: v.id,
      label: v.label,
      uses: v.uses,
      winRate: v.alpha + v.beta > 2
        ? (v.alpha - 1) / (v.alpha + v.beta - 2)
        : 0.5,
      alpha: v.alpha,
      beta: v.beta,
    }));
  }

  /**
   * Sample from a Beta distribution using the Jöhnk algorithm.
   * Simplified implementation suitable for our use case.
   */
  private sampleBeta(alpha: number, beta: number): number {
    // Use the inverse CDF method with uniform random for simplicity
    // For alpha, beta >= 1, a good approximation
    if (alpha === 1 && beta === 1) return Math.random();

    // Gamma sampling using Marsaglia-Tsang method
    const x = this.sampleGamma(alpha);
    const y = this.sampleGamma(beta);
    return x / (x + y);
  }

  /**
   * Sample from a Gamma distribution (shape > 0).
   * Uses Marsaglia-Tsang for shape >= 1, rejection for shape < 1.
   */
  private sampleGamma(shape: number): number {
    if (shape < 1) {
      // Boost shape to >= 1, then correct
      return this.sampleGamma(shape + 1) * Math.pow(Math.random(), 1 / shape);
    }

    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);

    while (true) {
      let x: number;
      let v: number;

      do {
        x = this.normalRandom();
        v = 1 + c * x;
      } while (v <= 0);

      v = v * v * v;
      const u = Math.random();

      if (u < 1 - 0.0331 * (x * x) * (x * x)) return d * v;
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  }

  /**
   * Standard normal random using Box-Muller transform.
   */
  private normalRandom(): number {
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  private loadMetrics(): void {
    try {
      if (fs.existsSync(this.metricsPath)) {
        const raw = fs.readFileSync(this.metricsPath, 'utf-8');
        const store: MetricsStore = JSON.parse(raw);
        for (const v of store.variants) {
          this.variants.set(`${v.agentName}:${v.id}`, v);
        }
      }
    } catch {
      // Start fresh if metrics file is corrupt
    }
  }

  private saveMetrics(): void {
    try {
      const dir = path.dirname(this.metricsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const store: MetricsStore = {
        variants: Array.from(this.variants.values()),
        lastUpdated: new Date().toISOString(),
      };
      fs.writeFileSync(this.metricsPath, JSON.stringify(store, null, 2), 'utf-8');
    } catch (err) {
      logger.warn('prompt-optimizer', `Failed to save metrics: ${(err as Error).message}`);
    }
  }
}

/** Singleton prompt optimizer instance */
export const promptOptimizer = new PromptOptimizer();
