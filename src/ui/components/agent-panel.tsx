import React, { useState, useEffect, useRef } from 'react';
import { Box, Text } from 'ink';
import { theme, agentMeta } from '../context/theme.js';
import { useAppState } from '../hooks/use-app-state.js';
import { Spinner } from './spinner.js';
import { eventBus } from '../../utils/event-bus.js';

function formatElapsed(startMs: number): string {
  const elapsed = Math.floor((Date.now() - startMs) / 1000);
  if (elapsed < 60) return `${elapsed}s`;
  const min = Math.floor(elapsed / 60);
  const sec = elapsed % 60;
  return `${min}m${sec.toString().padStart(2, '0')}s`;
}

export function AgentPanel() {
  const { state } = useAppState();
  const { activeAgent, activeTool, isProcessing } = state;
  const [isReasoning, setIsReasoning] = useState(false);
  const reasoningTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const onReasoning = () => {
      setIsReasoning(true);
      // Reset reasoning indicator after text starts
      if (reasoningTimeoutRef.current) clearTimeout(reasoningTimeoutRef.current);
    };

    const onStreaming = () => {
      // When regular text starts, we're no longer in reasoning mode
      setIsReasoning(false);
    };

    const onComplete = () => {
      setIsReasoning(false);
    };

    eventBus.on('agent:reasoning', onReasoning);
    eventBus.on('agent:streaming', onStreaming);
    eventBus.on('agent:complete', onComplete);

    return () => {
      eventBus.off('agent:reasoning', onReasoning);
      eventBus.off('agent:streaming', onStreaming);
      eventBus.off('agent:complete', onComplete);
      if (reasoningTimeoutRef.current) clearTimeout(reasoningTimeoutRef.current);
    };
  }, []);

  if (!isProcessing || !activeAgent) return null;

  const meta = agentMeta(activeAgent);

  return (
    <Box flexDirection="column" paddingX={1} paddingY={0}>
      <Box gap={1}>
        <Spinner color={meta.color} />
        <Text color={meta.color} bold>
          {meta.icon} {meta.label}
        </Text>
        <Text color={theme.ui.dim}>{'\u2502'}</Text>
        {activeTool ? (
          <Box gap={1}>
            <Text color={theme.ui.muted}>
              {'\u{1F527}'}{' '}
            </Text>
            <Text color={theme.ui.info} bold>{activeTool}</Text>
          </Box>
        ) : isReasoning ? (
          <Text color={theme.ui.muted}>
            {'\u{1F4AD}'} thinking...
          </Text>
        ) : (
          <Text color={theme.ui.muted}>
            {'\u{270D}\u{FE0F}'} writing...
          </Text>
        )}
      </Box>
    </Box>
  );
}
