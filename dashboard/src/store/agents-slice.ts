import { StateCreator } from 'zustand';

export interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
  result?: string;
  isError?: boolean;
  timestamp: number;
}

export interface AgentsSlice {
  activeAgent: string | null;
  activeTool: string | null;
  iteration: number;
  toolCalls: ToolCall[];

  setActiveAgent: (agent: string | null) => void;
  setActiveTool: (tool: string | null) => void;
  setIteration: (n: number) => void;
  addToolCall: (call: ToolCall) => void;
  updateLastToolResult: (result: string, isError: boolean) => void;
  clearAgent: () => void;
}

export const createAgentsSlice: StateCreator<AgentsSlice> = (set) => ({
  activeAgent: null,
  activeTool: null,
  iteration: 0,
  toolCalls: [],

  setActiveAgent: (agent) => set({ activeAgent: agent }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setIteration: (n) => set({ iteration: n }),
  addToolCall: (call) => set((state) => ({ toolCalls: [...state.toolCalls, call] })),
  updateLastToolResult: (result, isError) => set((state) => {
    if (state.toolCalls.length === 0) return state;
    const last = state.toolCalls[state.toolCalls.length - 1];
    return {
      toolCalls: [...state.toolCalls.slice(0, -1), { ...last, result, isError }],
    };
  }),
  clearAgent: () => set({ activeAgent: null, activeTool: null, iteration: 0, toolCalls: [] }),
});
