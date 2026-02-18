import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../context/theme.js';

interface ErrorDisplayProps {
  error: string;
  stack?: string;
  title?: string;
}

export function ErrorDisplay({ error, stack, title = 'Error' }: ErrorDisplayProps) {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.ui.error}
      paddingX={2}
      paddingY={0}
      marginX={1}
    >
      <Box gap={1}>
        <Text color={theme.ui.error} bold>
          {'\u2716'} {title}
        </Text>
      </Box>
      <Box paddingLeft={2}>
        <Text color={theme.ui.text}>{error}</Text>
      </Box>
      {stack && (
        <Box paddingLeft={2} marginTop={0}>
          <Text color={theme.ui.muted} dimColor>
            {stack}
          </Text>
        </Box>
      )}
    </Box>
  );
}
