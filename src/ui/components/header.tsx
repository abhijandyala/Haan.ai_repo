import React from 'react';
import { Box, Text } from 'ink';
import figlet from 'figlet';
import gradient from 'gradient-string';
import { theme } from '../context/theme.js';
import path from 'path';

export function Header() {
  let ascii: string;
  try {
    ascii = figlet.textSync('haan.ai', { font: 'ANSI Shadow', horizontalLayout: 'default' });
  } catch {
    try {
      ascii = figlet.textSync('haan.ai', { font: 'Standard' });
    } catch {
      ascii = '  haan.ai';
    }
  }

  const grad = gradient(theme.gradients.header);
  const colored = grad(ascii);

  const termWidth = process.stdout.columns || 80;
  const separator = '\u2500'.repeat(termWidth);
  const cwd = path.basename(process.cwd());

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text>{colored}</Text>
      <Box justifyContent="space-between" marginTop={-1}>
        <Text color={theme.ui.muted}>
          {'  '}Autonomous Coding Agent
        </Text>
        <Box gap={1}>
          <Text color={theme.ui.dim}>v1.0</Text>
          <Text color={theme.ui.dim}>{'\u2502'}</Text>
          <Text color={theme.ui.info}>{cwd}/</Text>
        </Box>
      </Box>
      <Text color={theme.ui.dim}>{separator}</Text>
    </Box>
  );
}
