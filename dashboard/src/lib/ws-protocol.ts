export interface WsEventMessage {
  type: 'event';
  event: string;
  data: Record<string, unknown>;
  timestamp: number;
}

export interface WsCommandMessage {
  type: 'start_pipeline' | 'approve' | 'cancel_pipeline' | 'switch_thread' | 'set_model' | 'ping';
  task?: string;
  mode?: string;
  stage?: string;
  approved?: boolean;
  threadId?: string;
  model?: string;
  provider?: string;
}

export type WsMessage = WsEventMessage | WsCommandMessage;
