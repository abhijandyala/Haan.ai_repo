import React, { createContext, useReducer, useCallback, type ReactNode } from 'react';
import { v4 as uuid } from 'uuid';

export interface MessageData {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool' | 'reasoning';
  agent?: string;
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

export interface AppState {
  messages: MessageData[];
  mode: 'auto' | 'human';
  view: 'pipeline' | 'pong' | 'snake';
  pipelineStage: string;
  activeAgent: string | null;
  activeTool: string | null;
  isProcessing: boolean;
  tokenCount: number;
  cost: string;
  approvalCallback: ((approved: boolean) => void) | null;
  approvalSummary: string;
  completedStages: string[];
  failedStage: string | null;
}

type Action =
  | { type: 'ADD_MESSAGE'; message: MessageData }
  | { type: 'APPEND_STREAMING'; content: string }
  | { type: 'FINALIZE_STREAMING' }
  | { type: 'CLEAR_MESSAGES' }
  | { type: 'SET_MODE'; mode: 'auto' | 'human' }
  | { type: 'SET_VIEW'; view: 'pipeline' | 'pong' | 'snake' }
  | { type: 'SET_ACTIVE_AGENT'; agent: string | null }
  | { type: 'SET_ACTIVE_TOOL'; tool: string | null }
  | { type: 'SET_PROCESSING'; processing: boolean }
  | { type: 'SET_PIPELINE_STAGE'; stage: string }
  | { type: 'COMPLETE_STAGE'; stage: string }
  | { type: 'FAIL_STAGE'; stage: string }
  | { type: 'CLEAR_PIPELINE' }
  | { type: 'SET_COST'; cost: string; tokens: number }
  | { type: 'SET_APPROVAL'; callback: ((approved: boolean) => void) | null; summary: string };

const initialState: AppState = {
  messages: [],
  mode: 'auto',
  view: 'pipeline',
  pipelineStage: '',
  activeAgent: null,
  activeTool: null,
  isProcessing: false,
  tokenCount: 0,
  cost: '/bin/sh.0000',
  approvalCallback: null,
  approvalSummary: '',
  completedStages: [],
  failedStage: null,
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.message] };
    case 'APPEND_STREAMING': {
      const msgs = [...state.messages];
      const last = msgs[msgs.length - 1];
      if (last?.isStreaming) {
        msgs[msgs.length - 1] = { ...last, content: last.content + action.content };
      }
      return { ...state, messages: msgs };
    }
    case 'FINALIZE_STREAMING': {
      const msgs = [...state.messages];
      const last = msgs[msgs.length - 1];
      if (last?.isStreaming) {
        msgs[msgs.length - 1] = { ...last, isStreaming: false };
      }
      return { ...state, messages: msgs };
    }
    case 'CLEAR_MESSAGES':
      return { ...state, messages: [] };
    case 'SET_MODE':
      return { ...state, mode: action.mode };
    case 'SET_VIEW':
      return { ...state, view: action.view };
    case 'SET_ACTIVE_AGENT':
      return { ...state, activeAgent: action.agent };
    case 'SET_ACTIVE_TOOL':
      return { ...state, activeTool: action.tool };
    case 'SET_PROCESSING':
      return { ...state, isProcessing: action.processing };
    case 'SET_PIPELINE_STAGE':
      return { ...state, pipelineStage: action.stage };
    case 'COMPLETE_STAGE':
      return {
        ...state,
        completedStages: [...state.completedStages, action.stage],
        pipelineStage: '',
      };
    case 'FAIL_STAGE':
      return { ...state, failedStage: action.stage, pipelineStage: '' };
    case 'CLEAR_PIPELINE':
      return {
        ...state,
        pipelineStage: '',
        activeAgent: null,
        activeTool: null,
        isProcessing: false,
        completedStages: [],
        failedStage: null,
      };
    case 'SET_COST':
      return { ...state, cost: action.cost, tokenCount: action.tokens };
    case 'SET_APPROVAL':
      return {
        ...state,
        approvalCallback: action.callback,
        approvalSummary: action.summary,
      };
    default:
      return state;
  }
}

export interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  addMessage: (role: MessageData['role'], content: string, agent?: string, isStreaming?: boolean) => void;
  clearMessages: () => void;
  setMode: (mode: 'auto' | 'human') => void;
  setView: (view: 'pipeline' | 'pong' | 'snake') => void;
  setActiveAgent: (agent: string | null) => void;
  setActiveTool: (tool: string | null) => void;
  setProcessing: (processing: boolean) => void;
  setPipelineStage: (stage: string) => void;
  completeStage: (stage: string) => void;
  failStage: (stage: string) => void;
  clearPipeline: () => void;
  setCost: (cost: string, tokens: number) => void;
  setApproval: (callback: ((approved: boolean) => void) | null, summary: string) => void;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const addMessage = useCallback(
    (role: MessageData['role'], content: string, agent?: string, isStreaming?: boolean) => {
      dispatch({
        type: 'ADD_MESSAGE',
        message: {
          id: uuid(),
          role,
          agent,
          content,
          timestamp: Date.now(),
          isStreaming,
        },
      });
    },
    [],
  );

  const clearMessages = useCallback(() => dispatch({ type: 'CLEAR_MESSAGES' }), []);
  const setMode = useCallback((mode: 'auto' | 'human') => dispatch({ type: 'SET_MODE', mode }), []);
  const setView = useCallback((view: 'pipeline' | 'pong' | 'snake') => dispatch({ type: 'SET_VIEW', view }), []);
  const setActiveAgent = useCallback((agent: string | null) => dispatch({ type: 'SET_ACTIVE_AGENT', agent }), []);
  const setActiveTool = useCallback((tool: string | null) => dispatch({ type: 'SET_ACTIVE_TOOL', tool }), []);
  const setProcessing = useCallback((processing: boolean) => dispatch({ type: 'SET_PROCESSING', processing }), []);
  const setPipelineStage = useCallback((stage: string) => dispatch({ type: 'SET_PIPELINE_STAGE', stage }), []);
  const completeStage = useCallback((stage: string) => dispatch({ type: 'COMPLETE_STAGE', stage }), []);
  const failStage = useCallback((stage: string) => dispatch({ type: 'FAIL_STAGE', stage }), []);
  const clearPipeline = useCallback(() => dispatch({ type: 'CLEAR_PIPELINE' }), []);
  const setCost = useCallback((cost: string, tokens: number) => dispatch({ type: 'SET_COST', cost, tokens }), []);
  const setApproval = useCallback(
    (callback: ((approved: boolean) => void) | null, summary: string) =>
      dispatch({ type: 'SET_APPROVAL', callback, summary }),
    [],
  );

  const value: AppContextValue = {
    state,
    dispatch,
    addMessage,
    clearMessages,
    setMode,
    setView,
    setActiveAgent,
    setActiveTool,
    setProcessing,
    setPipelineStage,
    completeStage,
    failStage,
    clearPipeline,
    setCost,
    setApproval,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
