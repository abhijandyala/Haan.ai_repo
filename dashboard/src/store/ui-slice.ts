import { StateCreator } from 'zustand';

export type CodePanelTab = 'changes' | 'diff';

export interface UiSlice {
  sidebarOpen: boolean;
  codePanelOpen: boolean;
  codePanelWidth: number;
  codePanelTab: CodePanelTab;
  selectedModel: string;
  selectedFile: string | null;
  commandPaletteOpen: boolean;
  thinkingStartedAt: number | null;
  settingsOpen: boolean;

  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleCodePanel: () => void;
  setCodePanelOpen: (open: boolean) => void;
  setCodePanelWidth: (width: number) => void;
  setCodePanelTab: (tab: CodePanelTab) => void;
  setSelectedModel: (model: string) => void;
  setSelectedFile: (file: string | null) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setThinkingStartedAt: (ts: number | null) => void;
  toggleSettings: () => void;
}

export const createUiSlice: StateCreator<UiSlice> = (set) => ({
  sidebarOpen: true,
  codePanelOpen: true,
  codePanelWidth: 400,
  codePanelTab: 'changes',
  selectedModel: 'claude-sonnet-4-20250514',
  selectedFile: null,
  commandPaletteOpen: false,
  thinkingStartedAt: null,
  settingsOpen: false,

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleCodePanel: () => set((s) => ({ codePanelOpen: !s.codePanelOpen })),
  setCodePanelOpen: (open) => set({ codePanelOpen: open }),
  setCodePanelWidth: (width) => set({ codePanelWidth: Math.max(300, Math.min(600, width)) }),
  setCodePanelTab: (tab) => set({ codePanelTab: tab }),
  setSelectedModel: (model) => set({ selectedModel: model }),
  setSelectedFile: (file) => set({ selectedFile: file }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setThinkingStartedAt: (ts) => set({ thinkingStartedAt: ts }),
  toggleSettings: () => set((s) => ({ settingsOpen: !s.settingsOpen })),
});
