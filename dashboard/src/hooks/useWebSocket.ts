import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store';
import type { WsCommandMessage, WsEventMessage } from '../lib/ws-protocol';

const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY = 3000;

function getWsUrl(): string {
  // In browser (Vite dev or production), derive WS URL from current page origin
  // so the Vite proxy can forward /ws to the backend.
  // In Tauri desktop, fall back to the local backend directly.
  if (typeof window !== 'undefined' && window.location) {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/ws`;
  }
  return 'ws://localhost:8000/ws';
}

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const store = useStore;

  const connect = useCallback(() => {
    const state = store.getState();
    if (state.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      store.getState().setStatus('error');
      store.getState().setError('Max reconnection attempts reached');
      return;
    }

    store.getState().setStatus('connecting');

    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      store.getState().setStatus('connected');
      store.getState().setError(null);
      store.getState().resetReconnect();
      store.getState().addToast({ message: 'Connected to server', type: 'success' });
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WsEventMessage;
        if (msg.type !== 'event') return;

        const data = msg.data;
        const s = store.getState();

        switch (msg.event) {
          case 'agent:thinking':
            s.setActiveAgent(data.agent as string);
            s.setIteration(data.iteration as number);
            s.setThinkingStartedAt(Date.now());
            break;

          case 'agent:streaming': {
            const lastMsg = s.messages[s.messages.length - 1];
            if (lastMsg?.isStreaming && lastMsg?.agent === (data.agent as string)) {
              s.appendToLast(data.text as string);
            } else {
              s.addMessage({
                role: 'assistant',
                agent: data.agent as string,
                content: data.text as string,
                isStreaming: true,
              });
            }
            break;
          }

          case 'agent:reasoning':
            s.addMessage({
              role: 'reasoning',
              agent: data.agent as string,
              content: data.text as string,
            });
            break;

          case 'agent:tool_call':
            s.setActiveTool(data.tool as string);
            s.addToolCall({
              tool: data.tool as string,
              args: (data.args as Record<string, unknown>) || {},
              timestamp: msg.timestamp,
            });
            s.addToolCallToLastMessage({
              id: 'tc-' + Date.now(),
              tool: data.tool as string,
              args: (data.args as Record<string, unknown>) || {},
              startedAt: msg.timestamp,
            });
            break;

          case 'agent:tool_result':
            s.setActiveTool(null);
            s.updateLastToolResult(
              data.result as string,
              (data.isError as boolean) || false,
            );
            s.updateLastToolCallResult(
              data.result as string,
              (data.isError as boolean) || false,
              (data.duration as number) || 0,
            );
            break;

          case 'agent:complete':
            s.finalizeStreaming();
            s.clearAgent();
            s.setThinkingStartedAt(null);
            break;

          case 'agent:error':
            s.addMessage({
              role: 'system',
              content: `Error: ${data.error as string}`,
            });
            s.addToast({ message: `Agent error: ${(data.error as string).slice(0, 80)}`, type: 'error' });
            break;

          case 'pipeline:start':
            s.startPipeline(
              data.task as string,
              data.mode as string,
            );
            break;

          case 'pipeline:stage_start':
            s.updateStage(data.stage as string, {
              status: 'active',
              agent: data.agent as string,
              startedAt: Date.now(),
            });
            s.setActiveAgent(data.agent as string);
            break;

          case 'pipeline:stage_complete':
            s.updateStage(data.stage as string, {
              status: 'complete',
              duration: data.duration as number,
              output: data.output,
            });
            break;

          case 'pipeline:stage_error':
            s.updateStage(data.stage as string, {
              status: 'failed',
              output: data.error,
            });
            break;

          case 'pipeline:complete':
            s.completePipeline(
              data.success as boolean,
              data.summary as string,
            );
            s.addToast({
              message: (data.success as boolean) ? 'Pipeline completed successfully' : 'Pipeline failed',
              type: (data.success as boolean) ? 'success' : 'error',
            });
            break;

          case 'pipeline:approval_needed':
            s.setApproval(
              data.stage as string,
              data.summary as string,
            );
            break;

          case 'pipeline:retry':
            s.addMessage({
              role: 'system',
              content: `Retrying stage: ${data.stage as string} (attempt ${data.attempt as number})`,
            });
            break;

          case 'cost:update':
            s.updateCost(
              data.model as string,
              data.inputTokens as number,
              data.outputTokens as number,
              data.cost as number,
            );
            break;
        }
      } catch {
        // Ignore non-JSON or malformed messages
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      const s = store.getState();
      const wasConnected = s.status === 'connected';
      s.setStatus('disconnected');
      s.incrementReconnect();

      // Only show toast on first disconnect, not every reconnect attempt
      if (wasConnected) {
        s.addToast({ message: 'Disconnected from server', type: 'error' });
      }

      if (store.getState().reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY);
      }
    };

    ws.onerror = () => {
      store.getState().setStatus('error');
    };
  }, [store]);

  const sendMessage = useCallback((msg: WsCommandMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }
  }, []);

  useEffect(() => {
    // Wire up sendMessage and disconnect to the store
    store.setState({ sendMessage, disconnect });

    connect();

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect, sendMessage, disconnect, store]);

  const startPipeline = useCallback((task: string, mode: string = 'auto') => {
    sendMessage({ type: 'start_pipeline', task, mode });
  }, [sendMessage]);

  const approve = useCallback((stage: string, approved: boolean) => {
    sendMessage({ type: 'approve', stage, approved });
    store.getState().clearApproval();
  }, [sendMessage, store]);

  return { sendMessage, startPipeline, approve };
}
