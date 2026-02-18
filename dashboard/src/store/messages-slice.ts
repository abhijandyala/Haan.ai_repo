import { StateCreator } from 'zustand';

export interface ToolCallData {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  result?: string;
  isError?: boolean;
  startedAt: number;
  duration?: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool' | 'reasoning';
  agent?: string;
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  toolCalls?: ToolCallData[];
}

export interface MessagesSlice {
  messages: Message[];

  addMessage: (msg: Omit<Message, 'id' | 'timestamp'>) => void;
  appendToLast: (text: string) => void;
  finalizeStreaming: () => void;
  clearMessages: () => void;
  addToolCallToLastMessage: (call: ToolCallData) => void;
  updateLastToolCallResult: (result: string, isError: boolean, duration: number) => void;
}

let msgCounter = 0;

export const createMessagesSlice: StateCreator<MessagesSlice> = (set) => ({
  messages: [],

  addMessage: (msg) => set((state) => ({
    messages: [...state.messages, {
      ...msg,
      id: `msg-${++msgCounter}`,
      timestamp: Date.now(),
    }],
  })),

  appendToLast: (text) => set((state) => {
    if (state.messages.length === 0) return state;
    const last = state.messages[state.messages.length - 1];
    return {
      messages: [
        ...state.messages.slice(0, -1),
        { ...last, content: last.content + text },
      ],
    };
  }),

  finalizeStreaming: () => set((state) => {
    if (state.messages.length === 0) return state;
    const last = state.messages[state.messages.length - 1];
    return {
      messages: [
        ...state.messages.slice(0, -1),
        { ...last, isStreaming: false },
      ],
    };
  }),

  clearMessages: () => set({ messages: [] }),

  addToolCallToLastMessage: (call) => set((state) => {
    // Find the last assistant message
    for (let i = state.messages.length - 1; i >= 0; i--) {
      if (state.messages[i].role === 'assistant') {
        const msg = state.messages[i];
        const toolCalls = [...(msg.toolCalls || []), call];
        return {
          messages: [
            ...state.messages.slice(0, i),
            { ...msg, toolCalls },
            ...state.messages.slice(i + 1),
          ],
        };
      }
    }
    return state;
  }),

  updateLastToolCallResult: (result, isError, duration) => set((state) => {
    // Find the last assistant message
    for (let i = state.messages.length - 1; i >= 0; i--) {
      if (state.messages[i].role === 'assistant' && state.messages[i].toolCalls?.length) {
        const msg = state.messages[i];
        const toolCalls = [...(msg.toolCalls || [])];
        const lastTc = toolCalls[toolCalls.length - 1];
        toolCalls[toolCalls.length - 1] = { ...lastTc, result, isError, duration };
        return {
          messages: [
            ...state.messages.slice(0, i),
            { ...msg, toolCalls },
            ...state.messages.slice(i + 1),
          ],
        };
      }
    }
    return state;
  }),
});
