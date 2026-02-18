import { StateCreator } from 'zustand';

export interface Thread {
  id: string;
  title: string;
  project?: string;
  status: 'running' | 'completed' | 'failed' | 'idle';
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  filesChanged: number;
  linesAdded: number;
  linesRemoved: number;
  model?: string;
}

export interface ThreadsSlice {
  threads: Thread[];
  activeThreadId: string | null;

  addThread: (thread: Omit<Thread, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateThread: (id: string, update: Partial<Thread>) => void;
  removeThread: (id: string) => void;
  setActiveThread: (id: string | null) => void;
  getActiveThread: () => Thread | undefined;
}

let threadCounter = 0;

export const createThreadsSlice: StateCreator<ThreadsSlice> = (set, get) => ({
  threads: [],
  activeThreadId: null,

  addThread: (thread) => {
    const id = `thread-${++threadCounter}`;
    const now = Date.now();
    set((state) => ({
      threads: [
        { ...thread, id, createdAt: now, updatedAt: now },
        ...state.threads,
      ],
      activeThreadId: id,
    }));
    return id;
  },

  updateThread: (id, update) =>
    set((state) => ({
      threads: state.threads.map((t) =>
        t.id === id ? { ...t, ...update, updatedAt: Date.now() } : t,
      ),
    })),

  removeThread: (id) =>
    set((state) => ({
      threads: state.threads.filter((t) => t.id !== id),
      activeThreadId: state.activeThreadId === id ? null : state.activeThreadId,
    })),

  setActiveThread: (id) => set({ activeThreadId: id }),

  getActiveThread: () => {
    const { threads, activeThreadId } = get();
    return threads.find((t) => t.id === activeThreadId);
  },
});
