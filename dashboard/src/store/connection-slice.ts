import { StateCreator } from 'zustand';
import type { WsCommandMessage } from '../lib/ws-protocol';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface ConnectionSlice {
  status: ConnectionStatus;
  error: string | null;
  reconnectAttempts: number;
  connected: boolean; // Convenience boolean for components
  toasts: ToastItem[];

  setStatus: (status: ConnectionStatus) => void;
  setError: (error: string | null) => void;
  incrementReconnect: () => void;
  resetReconnect: () => void;
  sendMessage: (msg: WsCommandMessage) => void;
  disconnect: () => void;
  addToast: (toast: Omit<ToastItem, 'id'>) => void;
  removeToast: (id: string) => void;
}

let toastCounter = 0;

export const createConnectionSlice: StateCreator<ConnectionSlice> = (set, get) => ({
  status: 'disconnected',
  error: null,
  reconnectAttempts: 0,
  connected: false,
  toasts: [],

  setStatus: (status) => set({ status, connected: status === 'connected' }),
  setError: (error) => set({ error }),
  incrementReconnect: () => set((state) => ({ reconnectAttempts: state.reconnectAttempts + 1 })),
  resetReconnect: () => set({ reconnectAttempts: 0 }),

  // These will be properly wired up by the WebSocket hook
  sendMessage: () => { /* No-op, will be replaced */ },
  disconnect: () => { /* No-op, will be replaced */ },

  addToast: (toast) => {
    const id = `toast-${++toastCounter}`;
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) })),
});
