import { StateCreator } from 'zustand';

export interface StageInfo {
  name: string;
  agent: string;
  status: 'pending' | 'active' | 'complete' | 'failed';
  duration?: number;
  output?: unknown;
  startedAt?: number;
}

export interface PipelineSlice {
  taskDescription: string;
  mode: 'auto' | 'human';
  stages: StageInfo[];
  isRunning: boolean;
  startedAt: number | null;
  approvalNeeded: { stage: string; summary: string } | null;

  startPipeline: (task: string, mode: string) => void;
  updateStage: (stage: string, update: Partial<StageInfo>) => void;
  setApproval: (stage: string, summary: string) => void;
  clearApproval: () => void;
  completePipeline: (success: boolean, summary: string) => void;
  reset: () => void;
}

export const createPipelineSlice: StateCreator<PipelineSlice> = (set) => ({
  taskDescription: '',
  mode: 'human',
  stages: [],
  isRunning: false,
  startedAt: null,
  approvalNeeded: null,

  startPipeline: (task, mode) => set({
    taskDescription: task,
    mode: mode as 'auto' | 'human',
    stages: [],
    isRunning: true,
    startedAt: Date.now(),
    approvalNeeded: null,
  }),

  updateStage: (stage, update) => set((state) => {
    const existing = state.stages.find(s => s.name === stage);
    if (existing) {
      return { stages: state.stages.map(s => s.name === stage ? { ...s, ...update } : s) };
    }
    return { stages: [...state.stages, { name: stage, agent: '', status: 'pending', ...update }] };
  }),

  setApproval: (stage, summary) => set({ approvalNeeded: { stage, summary } }),
  clearApproval: () => set({ approvalNeeded: null }),

  completePipeline: (_success, _summary) => set({ isRunning: false }),
  reset: () => set({ taskDescription: '', stages: [], isRunning: false, startedAt: null, approvalNeeded: null }),
});
