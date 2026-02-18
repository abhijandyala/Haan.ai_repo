import React from 'react';
import { Box, Text } from 'ink';
import { theme, agentMeta } from '../context/theme.js';
import { useAppState } from '../hooks/use-app-state.js';
import { Spinner } from './spinner.js';

const PIPELINE_STAGES = [
  { key: 'planning', aliases: ['plan', 'planning'], label: 'Plan', agent: 'planner', icon: '\u{1F9E0}' },
  { key: 'building', aliases: ['build', 'building'], label: 'Build', agent: 'builder', icon: '\u{1F528}' },
  { key: 'testing', aliases: ['test', 'testing'], label: 'Test', agent: 'tester', icon: '\u{1F9EA}' },
  { key: 'debugging', aliases: ['debug', 'debugging'], label: 'Debug', agent: 'debugger', icon: '\u{1F50D}' },
  { key: 'reviewing', aliases: ['review', 'reviewing'], label: 'Review', agent: 'feature-engineer', icon: '\u{2B50}' },
];

export function PipelineProgress() {
  const { state } = useAppState();
  const { pipelineStage, completedStages, failedStage } = state;

  const hasActivity = pipelineStage || completedStages.length > 0 || failedStage;
  if (!hasActivity) return null;

  const termWidth = process.stdout.columns || 80;
  const divider = '\u2500'.repeat(Math.min(termWidth - 4, 60));

  return (
    <Box flexDirection="column" paddingX={1} paddingY={0}>
      <Text color={theme.ui.dim}>{divider}</Text>
      <Box paddingX={0} paddingY={0} gap={0}>
        <Text color={theme.ui.dim}>  </Text>
        {PIPELINE_STAGES.map((stage, i) => {
          const isCompleted = stage.aliases.some(a => completedStages.includes(a));
          const isActive = stage.aliases.includes(pipelineStage);
          const isFailed = stage.aliases.some(a => failedStage === a);

          let statusChar: string;
          let stageColor: string;

          if (isFailed) {
            statusChar = '\u2718'; // X mark
            stageColor = theme.ui.error;
          } else if (isCompleted) {
            statusChar = '\u2714'; // checkmark
            stageColor = theme.ui.success;
          } else if (isActive) {
            statusChar = '\u25B6'; // play arrow
            const meta = agentMeta(stage.agent);
            stageColor = meta.color;
          } else {
            statusChar = '\u25CB'; // hollow circle
            stageColor = theme.ui.dim;
          }

          return (
            <React.Fragment key={stage.key}>
              <Box gap={0}>
                {isActive ? (
                  <Box gap={0}>
                    <Text color={stageColor} bold>{stage.icon} </Text>
                    <Text color={stageColor} bold>{stage.label}</Text>
                  </Box>
                ) : (
                  <Box gap={0}>
                    <Text color={stageColor}>{statusChar} </Text>
                    <Text color={stageColor}>{stage.label}</Text>
                  </Box>
                )}
              </Box>
              {i < PIPELINE_STAGES.length - 1 && (
                <Text color={isCompleted ? theme.ui.success : theme.ui.dim}>
                  {isCompleted ? ' \u2500\u2500\u25B8 ' : ' \u2500\u2500 '}
                </Text>
              )}
            </React.Fragment>
          );
        })}
      </Box>
      <Text color={theme.ui.dim}>{divider}</Text>
    </Box>
  );
}
