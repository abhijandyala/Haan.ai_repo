import React from 'react';
import { Box, Text, useInput } from 'ink';
import { theme } from '../context/theme.js';
import { useAppState } from '../hooks/use-app-state.js';

export function Confirmation() {
  const { state, setApproval } = useAppState();
  const { approvalCallback, approvalSummary } = state;

  useInput((input, key) => {
    if (!approvalCallback) return;
    const lower = input.toLowerCase();
    if (lower === 'y' || key.return) {
      approvalCallback(true);
      setApproval(null, '');
    } else if (lower === 'n') {
      approvalCallback(false);
      setApproval(null, '');
    }
  });

  if (!approvalCallback) return null;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.ui.warning}
      paddingX={2}
      paddingY={0}
      marginX={1}
    >
      <Box gap={1}>
        <Text color={theme.ui.warning} bold>
          {'\u{26A0}\u{FE0F}'} Approval Required
        </Text>
      </Box>
      {approvalSummary && (
        <Box paddingLeft={2}>
          <Text color={theme.ui.text}>{approvalSummary}</Text>
        </Box>
      )}
      <Box gap={1} marginTop={0}>
        <Text color={theme.ui.success} bold>
          [Y]
        </Text>
        <Text color={theme.ui.muted}>Approve and continue</Text>
        <Text color={theme.ui.dim}>{'\u2502'}</Text>
        <Text color={theme.ui.error} bold>
          [N]
        </Text>
        <Text color={theme.ui.muted}>Reject</Text>
      </Box>
    </Box>
  );
}
