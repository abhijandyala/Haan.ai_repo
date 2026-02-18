import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../context/theme.js';

interface DiffViewProps {
  diff: string;
  title?: string;
}

export function DiffView({ diff, title = 'Changes' }: DiffViewProps) {
  const lines = diff.split('\n');

  function lineColor(line: string): string {
    if (line.startsWith('+++') || line.startsWith('---')) return theme.ui.info;
    if (line.startsWith('@@')) return theme.ui.secondary;
    if (line.startsWith('+')) return theme.ui.success;
    if (line.startsWith('-')) return theme.ui.error;
    return theme.ui.text;
  }

  function linePrefix(line: string): string {
    if (line.startsWith('+') && !line.startsWith('+++')) return '\u{2795} ';
    if (line.startsWith('-') && !line.startsWith('---')) return '\u{2796} ';
    return '  ';
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.ui.dim}
      paddingX={1}
    >
      <Box marginBottom={0}>
        <Text color={theme.ui.info} bold>
          {'\u{1F4DD}'} {title}
        </Text>
      </Box>
      {lines.map((line, i) => (
        <Box key={i}>
          <Text color={lineColor(line)}>
            {linePrefix(line)}{line}
          </Text>
        </Box>
      ))}
    </Box>
  );
}
