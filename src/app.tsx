import React, { useCallback, useRef, useEffect } from 'react';
import { Box, useApp } from 'ink';
import { AppProvider } from './ui/context/app-context.js';
import { Header } from './ui/components/header.js';
import { StatusBar } from './ui/components/status-bar.js';
import { PipelineProgress } from './ui/components/pipeline-progress.js';
import { MessageList } from './ui/components/message-list.js';
import { AgentPanel } from './ui/components/agent-panel.js';
import { InputArea } from './ui/components/input-area.js';
import { Confirmation } from './ui/components/confirmation.js';
import { useMessages } from './ui/hooks/use-messages.js';
import { usePipeline } from './ui/hooks/use-pipeline.js';
import { useAppState } from './ui/hooks/use-app-state.js';
import { registerAllCommands, getCommand, type CommandContext } from './cli/commands/index.js';
import { parseInput, detectIntent } from './cli/input-parser.js';
import { PipelineEngine } from './pipeline/pipeline-engine.js';
import { PipelineStage } from './pipeline/types.js';
import { registerAllTools } from './tools/index.js';
import { getConfig, updateConfig } from './config/config-manager.js';
import { eventBus } from './utils/event-bus.js';
import PongGame from './ui/games/PongGame.js';

// Initialize tool and command registries once on import
registerAllCommands();
registerAllTools();

/** Stage mapping: intent → pipeline stages */
const INTENT_STAGE_MAP: Record<string, PipelineStage[]> = {
  plan: [PipelineStage.PLANNING],
  build: [PipelineStage.PLANNING, PipelineStage.BUILDING],
  test: [PipelineStage.TESTING],
  debug: [PipelineStage.DEBUGGING],
  review: [PipelineStage.REVIEWING],
};

interface AppProps {
  initialTask?: string;
}

export default function App({ initialTask }: AppProps) {
  return (
    <AppProvider>
      <AppCore initialTask={initialTask} />
    </AppProvider>
  );
}

function AppCore({ initialTask }: AppProps) {
  const { exit } = useApp();
  const {
    state,
    addMessage,
    clearMessages,
    setMode,
    setView,
    setProcessing,
    clearPipeline,
  } = useAppState();

  // Wire up event bus → UI state
  useMessages();
  usePipeline();

  const pipelineRef = useRef<PipelineEngine | null>(null);
  const hasRunInitial = useRef(false);

  // Auto-approve: if config.autoApprove, auto-accept all approval requests
  useEffect(() => {
    const config = getConfig();
    if (!config.autoApprove) return;

    const autoApproveHandler = (data: {
      stage: string;
      summary: string;
      resolve: (approved: boolean) => void;
    }) => {
      // Auto-approve without user input
      data.resolve(true);
    };

    eventBus.on('pipeline:approval_needed', autoApproveHandler);
    return () => {
      eventBus.off('pipeline:approval_needed', autoApproveHandler);
    };
  }, []);

  const runPipeline = useCallback(async (task: string, stages?: PipelineStage[]) => {
    setProcessing(true);
    clearPipeline();

    const engine = new PipelineEngine();
    pipelineRef.current = engine;

    try {
      await engine.execute({
        task,
        mode: getConfig().mode,
        stages,
      });
    } catch (err) {
      addMessage('system', `Pipeline error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setProcessing(false);
      pipelineRef.current = null;
    }
  }, [addMessage, setProcessing, clearPipeline]);

  // Run initial task if provided via CLI args
  useEffect(() => {
    if (initialTask && !hasRunInitial.current) {
      hasRunInitial.current = true;
      addMessage('user', initialTask);
      const intent = detectIntent(initialTask);
      if (intent === 'full') {
        runPipeline(initialTask);
      } else {
        runPipeline(initialTask, INTENT_STAGE_MAP[intent]);
      }
    }
  }, [initialTask, addMessage, runPipeline]);

  const commandContext: CommandContext = {
    addMessage: (role: string, content: string, agent?: string) => {
      addMessage(role as 'user' | 'assistant' | 'system' | 'tool', content, agent);
    },
    runPipeline: async (task: string, stages?: string[]) => {
      const pipelineStages = stages?.map(s => s as PipelineStage);
      await runPipeline(task, pipelineStages);
    },
    getConfig: () => getConfig(),
    setConfig: (key: string, value: string) => {
      let parsed: unknown = value;
      if (value === 'true') parsed = true;
      else if (value === 'false') parsed = false;
      else if (!isNaN(Number(value))) parsed = Number(value);
      updateConfig({ [key]: parsed });
    },
    setMode: (m: 'auto' | 'human') => {
      setMode(m);
      updateConfig({ mode: m });
    },
    setView: (v: 'pipeline' | 'pong') => {
      setView(v);
    },
    clearMessages,
  };

  const handleSubmit = useCallback(async (text: string) => {
    if (!text.trim()) return;

    // Handle quit
    if (text.trim() === '/quit' || text.trim() === '/exit') {
      exit();
      return;
    }

    const parsed = parseInput(text);

    if (parsed.type === 'command' && parsed.command) {
      const cmd = getCommand(parsed.command);
      if (cmd) {
        await cmd.execute(parsed.args || '', commandContext);
      } else {
        addMessage('system', `Unknown command: /${parsed.command}. Type /help for available commands.`);
      }
    } else {
      // Natural language → auto-detect intent → run appropriate pipeline stages
      addMessage('user', text);
      const intent = detectIntent(text);

      if (intent === 'full') {
        await runPipeline(text);
      } else {
        await runPipeline(text, INTENT_STAGE_MAP[intent]);
      }
    }
  }, [commandContext, addMessage, runPipeline, exit]);

  // Render Pong game if in pong view
  if (state.view === 'pong') {
    return <PongGame onExit={() => setView('pipeline')} />;
  }

  return (
    <Box flexDirection="column">
      <Header />
      <PipelineProgress />
      <Box flexDirection="column" flexGrow={1}>
        <MessageList />
      </Box>
      <AgentPanel />
      <Confirmation />
      <InputArea onSubmit={handleSubmit} />
      <StatusBar />
    </Box>
  );
}
