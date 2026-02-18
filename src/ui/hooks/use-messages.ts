import { useEffect, useRef } from 'react';
import { eventBus } from '../../utils/event-bus.js';
import { useAppState } from './use-app-state.js';

export function useMessages() {
  const { state, addMessage, clearMessages, dispatch } = useAppState();
  // Track which agent is currently streaming to avoid stale closures
  const streamingAgentRef = useRef<string | null>(null);
  // Track if we're currently in a reasoning block
  const reasoningAgentRef = useRef<string | null>(null);

  useEffect(() => {
    const onReasoning = (data: { agent: string; text: string }) => {
      if (reasoningAgentRef.current === data.agent) {
        // Append to existing reasoning message
        dispatch({ type: 'APPEND_STREAMING', content: data.text });
      } else {
        // Finalize any prior streaming message from a different context
        if (streamingAgentRef.current) {
          dispatch({ type: 'FINALIZE_STREAMING' });
          streamingAgentRef.current = null;
        }
        if (reasoningAgentRef.current) {
          dispatch({ type: 'FINALIZE_STREAMING' });
        }
        reasoningAgentRef.current = data.agent;
        addMessage('reasoning', data.text, data.agent, true);
      }
    };

    const onStreaming = (data: { agent: string; text: string }) => {
      // Finalize any reasoning block when regular text starts
      if (reasoningAgentRef.current) {
        dispatch({ type: 'FINALIZE_STREAMING' });
        reasoningAgentRef.current = null;
      }

      if (streamingAgentRef.current === data.agent) {
        // Append to existing streaming message (reducer handles concat)
        dispatch({ type: 'APPEND_STREAMING', content: data.text });
      } else {
        // Start a new streaming message
        if (streamingAgentRef.current) {
          dispatch({ type: 'FINALIZE_STREAMING' });
        }
        streamingAgentRef.current = data.agent;
        addMessage('assistant', data.text, data.agent, true);
      }
    };

    const onComplete = (_data: { agent: string; output: unknown }) => {
      dispatch({ type: 'FINALIZE_STREAMING' });
      streamingAgentRef.current = null;
      reasoningAgentRef.current = null;
    };

    const onUiMessage = (data: { role: string; agent?: string; content: string }) => {
      addMessage(data.role as 'system' | 'assistant' | 'tool', data.content, data.agent);
    };

    const onClear = () => {
      clearMessages();
    };

    eventBus.on('agent:reasoning', onReasoning);
    eventBus.on('agent:streaming', onStreaming);
    eventBus.on('agent:complete', onComplete);
    eventBus.on('ui:message', onUiMessage);
    eventBus.on('ui:clear', onClear);

    return () => {
      eventBus.off('agent:reasoning', onReasoning);
      eventBus.off('agent:streaming', onStreaming);
      eventBus.off('agent:complete', onComplete);
      eventBus.off('ui:message', onUiMessage);
      eventBus.off('ui:clear', onClear);
    };
  }, [addMessage, clearMessages, dispatch]);

  return { messages: state.messages, addMessage, clearMessages };
}
