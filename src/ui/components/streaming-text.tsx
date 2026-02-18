import React from 'react';
import { Text } from 'ink';
import { useStreaming } from '../hooks/use-streaming.js';

interface StreamingTextProps {
  text: string;
  speed?: number;
  color?: string;
}

export function StreamingText({ text, speed = 8, color }: StreamingTextProps) {
  const { displayText, isComplete } = useStreaming(text, speed);

  return (
    <Text color={color}>
      {displayText}
      {!isComplete && <Text color="#818CF8">{'\u2588'}</Text>}
    </Text>
  );
}
