import React from 'react';
import { Box } from 'ink';
import { AppProvider } from './context/app-context.js';
import { Header } from './components/header.js';
import { StatusBar } from './components/status-bar.js';
import { PipelineProgress } from './components/pipeline-progress.js';
import { MessageList } from './components/message-list.js';
import { AgentPanel } from './components/agent-panel.js';
import { InputArea } from './components/input-area.js';
import { Confirmation } from './components/confirmation.js';
import { useMessages } from './hooks/use-messages.js';
import { usePipeline } from './hooks/use-pipeline.js';

interface AppCoreProps {
  onSubmit: (text: string) => void;
}

function AppCore({ onSubmit }: AppCoreProps) {
  useMessages();
  const pipeline = usePipeline();

  const approvalNeeded = pipeline.approvalCallback !== null;

  return (
    <Box flexDirection="column">
      <Header />
      <Box flexDirection="column" flexGrow={1}>
        <PipelineProgress />
        <Box flexDirection="column" flexGrow={1}>
          <MessageList />
        </Box>
        <AgentPanel />
        {approvalNeeded && <Confirmation />}
      </Box>
      <InputArea onSubmit={onSubmit} />
      <StatusBar />
    </Box>
  );
}

interface AppLayoutProps {
  onSubmit: (text: string) => void;
}

export function AppLayout({ onSubmit }: AppLayoutProps) {
  return (
    <AppProvider>
      <AppCore onSubmit={onSubmit} />
    </AppProvider>
  );
}
