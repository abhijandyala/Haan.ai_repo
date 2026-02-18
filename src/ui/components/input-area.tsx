import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { theme } from '../context/theme.js';
import { useAppState } from '../hooks/use-app-state.js';
import { Spinner } from './spinner.js';

interface InputAreaProps {
  onSubmit: (text: string) => void;
}

export function InputArea({ onSubmit }: InputAreaProps) {
  const [value, setValue] = useState('');
  const { state } = useAppState();
  const { isProcessing, activeAgent, activeTool } = state;

  const handleSubmit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue('');
  };

  if (isProcessing) {
    return (
      <Box paddingX={1} paddingY={0} gap={1}>
        <Spinner label="" color={theme.ui.secondary} />
        <Text color={theme.ui.muted}>
          {activeAgent ? `${activeAgent}` : 'processing'}
          {activeTool ? ` \u{2192} ${activeTool}` : ''}
          <Text color={theme.ui.dim}>...</Text>
        </Text>
      </Box>
    );
  }

  return (
    <Box paddingX={1} paddingY={0}>
      <Text color={theme.ui.secondary} bold>haan</Text>
      <Text color={theme.ui.dim}> {'\u276F'} </Text>
      <TextInput
        value={value}
        onChange={setValue}
        onSubmit={handleSubmit}
        placeholder="describe a task, or type /help"
      />
    </Box>
  );
}
