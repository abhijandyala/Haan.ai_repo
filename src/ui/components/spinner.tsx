import React from 'react';
import { Box, Text } from 'ink';
import InkSpinner from 'ink-spinner';

interface SpinnerProps {
  label?: string;
  color?: string;
}

export function Spinner({ label, color = '#818CF8' }: SpinnerProps) {
  return (
    <Box gap={1}>
      <Text color={color}>
        <InkSpinner type="dots" />
      </Text>
      {label && <Text color={color}>{label}</Text>}
    </Box>
  );
}
