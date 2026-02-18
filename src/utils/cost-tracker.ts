import { eventBus } from './event-bus.js';
import { logger } from './logger.js';

interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
}

export class BudgetExceededError extends Error {
  constructor(
    public readonly limit: string,
    public readonly current: number,
    public readonly max: number,
  ) {
    super(`Budget exceeded (${limit}): $${current.toFixed(4)} / $${max.toFixed(4)}`);
    this.name = 'BudgetExceededError';
  }
}

interface BudgetConfig {
  dailyLimit?: number;
  perTaskLimit?: number;
}

const PRICING: Record<string, ModelPricing> = {
  // Anthropic
  'claude-opus-4-5-20251101': { inputPer1M: 5.0, outputPer1M: 25.0 },
  'claude-opus-4-5': { inputPer1M: 5.0, outputPer1M: 25.0 },
  'claude-sonnet-4-5-20250929': { inputPer1M: 3.0, outputPer1M: 15.0 },
  'claude-sonnet-4-5': { inputPer1M: 3.0, outputPer1M: 15.0 },
  // OpenAI
  'gpt-4.1': { inputPer1M: 2.0, outputPer1M: 8.0 },
  'gpt-4o': { inputPer1M: 2.5, outputPer1M: 10.0 },
  'gpt-4.1-mini': { inputPer1M: 0.4, outputPer1M: 1.6 },
  'gpt-5': { inputPer1M: 5.0, outputPer1M: 20.0 },
  'gpt-5-mini': { inputPer1M: 1.0, outputPer1M: 4.0 },
  'gpt-5.2-codex': { inputPer1M: 5.0, outputPer1M: 20.0 },
  'gpt-5.1-codex': { inputPer1M: 3.0, outputPer1M: 12.0 },
  'gpt-5.1-codex-max': { inputPer1M: 5.0, outputPer1M: 20.0 },
  'o4-mini': { inputPer1M: 1.1, outputPer1M: 4.4 },
  'o3-mini': { inputPer1M: 1.1, outputPer1M: 4.4 },
  // Google
  'gemini-2.5-pro': { inputPer1M: 1.25, outputPer1M: 10.0 },
  'gemini-3-pro-preview': { inputPer1M: 1.25, outputPer1M: 10.0 },
  'gemini-2.5-flash': { inputPer1M: 0.15, outputPer1M: 0.6 },
};

interface UsageEntry {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

class CostTracker {
  private entries: UsageEntry[] = [];
  private totalCost = 0;
  private totalInputTokens = 0;
  private totalOutputTokens = 0;
  private taskCost = 0;
  private dailyCost = 0;
  private dailyResetDate: string = new Date().toISOString().slice(0, 10);
  private budget: BudgetConfig = {};

  constructor() {
    eventBus.on('cost:update', (data) => this.track(data));
  }

  /**
   * Set budget limits. Pass undefined values to disable a limit.
   */
  setBudget(config: BudgetConfig): void {
    this.budget = config;
    logger.info('cost-tracker', `Budget set: daily=$${config.dailyLimit ?? 'unlimited'}, perTask=$${config.perTaskLimit ?? 'unlimited'}`);
  }

  /**
   * Reset per-task cost tracking (call at the start of each pipeline).
   */
  resetTaskCost(): void {
    this.taskCost = 0;
  }

  /**
   * Check if a new LLM call with estimated cost would exceed the budget.
   * Throws BudgetExceededError if it would.
   */
  checkBudget(estimatedCost: number = 0): void {
    // Rotate daily cost if date changed
    const today = new Date().toISOString().slice(0, 10);
    if (today !== this.dailyResetDate) {
      this.dailyCost = 0;
      this.dailyResetDate = today;
    }

    if (this.budget.perTaskLimit !== undefined) {
      if (this.taskCost + estimatedCost > this.budget.perTaskLimit) {
        throw new BudgetExceededError('per-task', this.taskCost, this.budget.perTaskLimit);
      }
    }

    if (this.budget.dailyLimit !== undefined) {
      if (this.dailyCost + estimatedCost > this.budget.dailyLimit) {
        throw new BudgetExceededError('daily', this.dailyCost, this.budget.dailyLimit);
      }
    }
  }

  track(entry: { model: string; inputTokens: number; outputTokens: number; cost?: number }) {
    const pricing = PRICING[entry.model] || { inputPer1M: 5.0, outputPer1M: 15.0 };
    const calculated = (
      (entry.inputTokens / 1_000_000) * pricing.inputPer1M +
      (entry.outputTokens / 1_000_000) * pricing.outputPer1M
    );
    const baseCost = (entry.cost !== undefined && entry.cost > 0) ? entry.cost : calculated;
    const cost = baseCost * 1.5; // 1.5x markup for profit margin
    const record: UsageEntry = { ...entry, cost };
    this.entries.push(record);
    this.totalCost += cost;
    this.taskCost += cost;
    this.dailyCost += cost;
    this.totalInputTokens += entry.inputTokens;
    this.totalOutputTokens += entry.outputTokens;
  }

  getSummary() {
    return {
      totalCost: this.totalCost,
      totalInputTokens: this.totalInputTokens,
      totalOutputTokens: this.totalOutputTokens,
      totalTokens: this.totalInputTokens + this.totalOutputTokens,
      entries: this.entries,
      byModel: this.entries.reduce<Record<string, { input: number; output: number; cost: number }>>((acc, e) => {
        if (!acc[e.model]) acc[e.model] = { input: 0, output: 0, cost: 0 };
        acc[e.model].input += e.inputTokens;
        acc[e.model].output += e.outputTokens;
        acc[e.model].cost += e.cost;
        return acc;
      }, {}),
    };
  }

  formatCost(): string {
    return `$${this.totalCost.toFixed(4)}`;
  }

  formatTokens(): string {
    const total = this.totalInputTokens + this.totalOutputTokens;
    if (total > 1_000_000) return `${(total / 1_000_000).toFixed(1)}M`;
    if (total > 1_000) return `${(total / 1_000).toFixed(1)}K`;
    return `${total}`;
  }

  reset() {
    this.entries = [];
    this.totalCost = 0;
    this.totalInputTokens = 0;
    this.totalOutputTokens = 0;
  }
}

export const costTracker = new CostTracker();
