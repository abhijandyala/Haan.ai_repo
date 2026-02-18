import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../context/theme.js';
import { useAppState } from '../hooks/use-app-state.js';
import { MessageBubble } from './message-bubble.js';

export function MessageList() {
  const { state } = useAppState();
  const { messages } = state;

  if (messages.length === 0) {
    return (
      <Box flexDirection="column" paddingY={1} paddingX={2}>
        <Box flexDirection="column" alignItems="center">
          <Text color={theme.ui.secondary} bold>
            {'\u2728'} Ready to build
          </Text>
          <Text color={theme.ui.muted}>
            Describe what you want to build, fix, or change.
          </Text>
        </Box>
        <Box flexDirection="column" marginTop={1} paddingLeft={2}>
          <Text color={theme.ui.dim}>  Try:</Text>
          <Text color={theme.ui.info}>    {'\u276F'} "Build a REST API with auth and rate limiting"</Text>
          <Text color={theme.ui.info}>    {'\u276F'} "Fix the failing tests in src/utils"</Text>
          <Text color={theme.ui.info}>    {'\u276F'} "Refactor the database module to use connection pooling"</Text>
          <Text color={theme.ui.info}>    {'\u276F'} "Add dark mode to the settings page"</Text>
        </Box>
        <Box marginTop={1} paddingLeft={2}>
          <Text color={theme.ui.dim}>
            Tip: Use <Text color={theme.ui.warning} bold>/help</Text> for commands, <Text color={theme.ui.warning} bold>--mode human</Text> for step-by-step approval
          </Text>
        </Box>
      </Box>
    );
  }

  const termHeight = process.stdout.rows || 40;
  const maxVisible = Math.max(5, termHeight - 18);
  const visibleMessages = messages.slice(-maxVisible);

  return (
    <Box flexDirection="column">
      {messages.length > maxVisible && (
        <Box paddingX={1}>
          <Text color={theme.ui.dim}>
            {'\u2191'} {messages.length - maxVisible} earlier messages
          </Text>
        </Box>
      )}
      {visibleMessages.map((msg, i) => (
        <React.Fragment key={msg.id}>
          {i > 0 && (
            <Box paddingX={2}>
              <Text color={theme.ui.dim}>
                {'\u2500'.repeat(Math.min(process.stdout.columns - 8 || 40, 50))}
              </Text>
            </Box>
          )}
          <MessageBubble message={msg} />
        </React.Fragment>
      ))}
    </Box>
  );
}
