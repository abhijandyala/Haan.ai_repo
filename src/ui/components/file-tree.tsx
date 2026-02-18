import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../context/theme.js';

export interface TreeNode {
  name: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
}

interface FileTreeProps {
  tree: TreeNode[];
  title?: string;
}

function renderNode(node: TreeNode, prefix: string, isLast: boolean): React.ReactNode[] {
  const connector = isLast ? '\u2514\u2500\u2500' : '\u251C\u2500\u2500';
  const icon = node.type === 'directory' ? '\u{1F4C1}' : '\u{1F4C4}';
  const nameColor = node.type === 'directory' ? theme.ui.info : theme.ui.text;

  const elements: React.ReactNode[] = [
    <Box key={`${prefix}-${node.name}`}>
      <Text color={theme.ui.dim}>{prefix}{connector} </Text>
      <Text>{icon} </Text>
      <Text color={nameColor} bold={node.type === 'directory'}>
        {node.name}{node.type === 'directory' ? '/' : ''}
      </Text>
    </Box>,
  ];

  if (node.children) {
    const childPrefix = prefix + (isLast ? '    ' : '\u2502   ');
    node.children.forEach((child, i) => {
      elements.push(
        ...renderNode(child, childPrefix, i === node.children!.length - 1),
      );
    });
  }

  return elements;
}

export function FileTree({ tree, title }: FileTreeProps) {
  return (
    <Box flexDirection="column" paddingX={1}>
      {title && (
        <Text color={theme.ui.info} bold>
          {'\u{1F4C2}'} {title}
        </Text>
      )}
      {tree.map((node, i) => (
        <React.Fragment key={node.name}>
          {renderNode(node, ' ', i === tree.length - 1)}
        </React.Fragment>
      ))}
    </Box>
  );
}
