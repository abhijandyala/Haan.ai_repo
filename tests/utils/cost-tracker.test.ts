import { describe, it, expect, beforeEach } from 'vitest';
import { costTracker, BudgetExceededError } from '../../src/utils/cost-tracker.js';

describe('CostTracker Budget', () => {
  beforeEach(() => {
    costTracker.reset();
    costTracker.resetTaskCost();
  });

  it('should track costs normally without budget', () => {
    costTracker.track({ model: 'gpt-4.1', inputTokens: 1000, outputTokens: 500 });
    const summary = costTracker.getSummary();
    expect(summary.totalCost).toBeGreaterThan(0);
    expect(summary.totalInputTokens).toBe(1000);
    expect(summary.totalOutputTokens).toBe(500);
  });

  it('should throw BudgetExceededError when per-task limit exceeded', () => {
    costTracker.setBudget({ perTaskLimit: 0.001 });
    // Track enough to exceed the tiny budget
    costTracker.track({ model: 'gpt-5', inputTokens: 10000, outputTokens: 5000 });
    expect(() => costTracker.checkBudget(0)).toThrow(BudgetExceededError);
  });

  it('should not throw when under budget', () => {
    costTracker.setBudget({ perTaskLimit: 100 });
    costTracker.track({ model: 'gpt-4.1', inputTokens: 100, outputTokens: 50 });
    expect(() => costTracker.checkBudget(0)).not.toThrow();
  });

  it('should throw BudgetExceededError when daily limit exceeded', () => {
    costTracker.setBudget({ dailyLimit: 0.001 });
    costTracker.track({ model: 'gpt-5', inputTokens: 10000, outputTokens: 5000 });
    expect(() => costTracker.checkBudget(0)).toThrow(BudgetExceededError);
  });

  it('should reset task cost independently', () => {
    costTracker.setBudget({ perTaskLimit: 0.01 });
    costTracker.track({ model: 'gpt-4.1', inputTokens: 1000, outputTokens: 500 });
    costTracker.resetTaskCost();
    // After reset, should be under budget again
    expect(() => costTracker.checkBudget(0)).not.toThrow();
  });
});
