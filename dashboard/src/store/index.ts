import { create } from 'zustand';
import { PipelineSlice, createPipelineSlice } from './pipeline-slice';
import { MessagesSlice, createMessagesSlice } from './messages-slice';
import { AgentsSlice, createAgentsSlice } from './agents-slice';
import { CostSlice, createCostSlice } from './cost-slice';
import { ConnectionSlice, createConnectionSlice } from './connection-slice';
import { ThreadsSlice, createThreadsSlice } from './threads-slice';
import { UiSlice, createUiSlice } from './ui-slice';

export type AppStore = PipelineSlice &
  MessagesSlice &
  AgentsSlice &
  CostSlice &
  ConnectionSlice &
  ThreadsSlice &
  UiSlice;

export const useStore = create<AppStore>()((...a) => ({
  ...createPipelineSlice(...a),
  ...createMessagesSlice(...a),
  ...createAgentsSlice(...a),
  ...createCostSlice(...a),
  ...createConnectionSlice(...a),
  ...createThreadsSlice(...a),
  ...createUiSlice(...a),
}));
