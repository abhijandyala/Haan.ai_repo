import { StateCreator } from 'zustand';

export interface CostSlice {
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  breakdown: Record<string, { cost: number; inputTokens: number; outputTokens: number }>;

  updateCost: (model: string, inputTokens: number, outputTokens: number, cost: number) => void;
  resetCost: () => void;
}

export const createCostSlice: StateCreator<CostSlice> = (set) => ({
  totalCost: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  breakdown: {},

  updateCost: (model, inputTokens, outputTokens, cost) => set((state) => {
    const existing = state.breakdown[model] || { cost: 0, inputTokens: 0, outputTokens: 0 };
    return {
      totalCost: state.totalCost + cost,
      totalInputTokens: state.totalInputTokens + inputTokens,
      totalOutputTokens: state.totalOutputTokens + outputTokens,
      breakdown: {
        ...state.breakdown,
        [model]: {
          cost: existing.cost + cost,
          inputTokens: existing.inputTokens + inputTokens,
          outputTokens: existing.outputTokens + outputTokens,
        },
      },
    };
  }),

  resetCost: () => set({ totalCost: 0, totalInputTokens: 0, totalOutputTokens: 0, breakdown: {} }),
});
