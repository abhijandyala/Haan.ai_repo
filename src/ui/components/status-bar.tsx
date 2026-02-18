import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { theme, agentMeta } from '../context/theme.js';
import { useAppState } from '../hooks/use-app-state.js';

export function StatusBar() {
  const { state } = useAppState();
  const { mode, activeAgent, tokenCount, cost, isProcessing } = state;

  // Elapsed time ticker — resets when processing restarts
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = React.useRef(Date.now());

  useEffect(() => {
    if (!isProcessing) {
      setElapsed(0);
      return;
    }
    startTimeRef.current = Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isProcessing]);

  const modeColor = mode === 'auto' ? theme.ui.success : theme.ui.warning;
  const modeLabel = mode === 'auto' ? 'AUTO' : 'HUMAN';

  const agentInfo = activeAgent ? agentMeta(activeAgent) : null;

  const formatTokens = (count: number): string => {
    if (count > 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
    if (count > 1_000) return `${(count / 1_000).toFixed(1)}K`;
    return `${count}`;
  };

  const formatElapsed = (secs: number): string => {
    if (secs < 60) return `${secs}s`;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const termWidth = process.stdout.columns || 80;
  const separator = '\u2500'.repeat(termWidth);

  return (
    <Box flexDirection="column">
      <Text color={theme.ui.dim}>{separator}</Text>
      <Box paddingX={1} justifyContent="space-between">
        <Box gap={1}>
          <Text color={theme.ui.dim}>[</Text>
          <Text color={modeColor} bold>{modeLabel}</Text>
          <Text color={theme.ui.dim}>]</Text>

          <Text color={theme.ui.dim}>{'\u2502'}</Text>

          {agentInfo ? (
            <Text color={agentInfo.color} bold>
              {agentInfo.icon} {agentInfo.label}
            </Text>
          ) : (
            <Text color={theme.ui.muted}>idle</Text>
          )}

          {isProcessing && (
            <>
              <Text color={theme.ui.dim}>{'\u2502'}</Text>
              <Text color={theme.ui.muted}>{formatElapsed(elapsed)}</Text>
            </>
          )}
        </Box>

        <Box gap={1}>
          <Text color={theme.ui.dim}>tokens</Text>
          <Text color={theme.ui.info} bold>{formatTokens(tokenCount)}</Text>

          <Text color={theme.ui.dim}>{'\u2502'}</Text>

          <Text color={theme.ui.dim}>cost</Text>
          <Text color={theme.ui.warning} bold>{cost}</Text>
        </Box>
      </Box>
    </Box>
  );
}
