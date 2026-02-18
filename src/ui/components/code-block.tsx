import React from 'react';
import { Box, Text } from 'ink';
import { highlight } from 'cli-highlight';
import { theme } from '../context/theme.js';

interface CodeBlockProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
}

export function CodeBlock({ code, language = 'typescript', showLineNumbers = true }: CodeBlockProps) {
  let highlighted: string;
  try {
    highlighted = highlight(code, { language, ignoreIllegals: true });
  } catch {
    highlighted = code;
  }

  const lines = highlighted.split('\n');

  const gutterWidth = String(lines.length).length;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.ui.dim}
      paddingX={1}
      marginY={0}
    >
      {language && (
        <Box marginBottom={0}>
          <Text color={theme.ui.muted} dimColor>
            {'\u{1F4C4}'} {language}
          </Text>
        </Box>
      )}
      {lines.map((line, i) => (
        <Box key={i}>
          {showLineNumbers && (
            <Box width={gutterWidth + 2}>
              <Text color={theme.ui.dim}>
                {String(i + 1).padStart(gutterWidth, ' ')} {'\u2502'}
              </Text>
            </Box>
          )}
          <Text>{line}</Text>
        </Box>
      ))}
    </Box>
  );
}
