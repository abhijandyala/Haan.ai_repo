import { useEffect } from 'react';
import { eventBus } from '../../utils/event-bus.js';
import { costTracker } from '../../utils/cost-tracker.js';
import { useAppState } from './use-app-state.js';

export function usePipeline() {
  const {
    state,
    addMessage,
    setActiveAgent,
    setActiveTool,
    setProcessing,
    setPipelineStage,
    completeStage,
    failStage,
    clearPipeline,
    setApproval,
    setCost,
  } = useAppState();

  useEffect(() => {
    const onStageStart = (data: { stage: string; agent: string }) => {
      setPipelineStage(data.stage);
      setActiveAgent(data.agent);
      setProcessing(true);
    };

    const onStageComplete = (data: { stage: string }) => {
      completeStage(data.stage);
      setActiveAgent(null);
      setActiveTool(null);
    };

    const onStageError = (data: { stage: string }) => {
      failStage(data.stage);
      setProcessing(false);
    };

    const onComplete = (data: { success: boolean; summary: string }) => {
      // Show a rich completion summary
      if (data.success) {
        const cost = costTracker.formatCost();
        const summary = costTracker.getSummary();
        const tokens = summary.totalTokens;
        const tokenStr = tokens > 1000 ? `${(tokens / 1000).toFixed(1)}K` : `${tokens}`;

        addMessage(
          'system',
          `\u{2705} **Pipeline complete**\n\n${data.summary}\n\n**Tokens:** ${tokenStr}  **Cost:** ${cost}`,
        );
      } else {
        addMessage(
          'system',
          `\u{274C} **Pipeline failed**\n\n${data.summary}`,
        );
      }
      clearPipeline();
    };

    const onRetry = (data: { stage: string; attempt: number; maxRetries: number }) => {
      addMessage(
        'system',
        `\u{1F504} **Retry ${data.attempt}/${data.maxRetries}** \u2014 re-entering debug \u2192 build \u2192 test loop`,
      );
    };

    const onImprovement = (data: { pass: number; score: number }) => {
      addMessage(
        'system',
        `\u{1F504} **Improvement pass ${data.pass}** \u2014 reviewer scored ${data.score}/10, iterating to improve...`,
      );
    };

    const onApprovalNeeded = (data: {
      stage: string;
      summary: string;
      resolve: (approved: boolean) => void;
    }) => {
      setApproval(data.resolve, data.summary);
      setProcessing(false);
    };

    const onToolCall = (data: { agent: string; tool: string }) => {
      setActiveTool(data.tool);
    };

    const onToolResult = () => {
      setActiveTool(null);
    };

    const onCostUpdate = () => {
      setCost(costTracker.formatCost(), costTracker.getSummary().totalTokens);
    };

    const onThinking = (data: { agent: string }) => {
      setActiveAgent(data.agent);
      setProcessing(true);
    };

    eventBus.on('pipeline:stage_start', onStageStart);
    eventBus.on('pipeline:stage_complete', onStageComplete);
    eventBus.on('pipeline:stage_error', onStageError);
    eventBus.on('pipeline:complete', onComplete);
    eventBus.on('pipeline:retry', onRetry);
    eventBus.on('pipeline:improvement', onImprovement);
    eventBus.on('pipeline:approval_needed', onApprovalNeeded);
    eventBus.on('agent:tool_call', onToolCall);
    eventBus.on('agent:tool_result', onToolResult);
    eventBus.on('cost:update', onCostUpdate);
    eventBus.on('agent:thinking', onThinking);

    return () => {
      eventBus.off('pipeline:stage_start', onStageStart);
      eventBus.off('pipeline:stage_complete', onStageComplete);
      eventBus.off('pipeline:stage_error', onStageError);
      eventBus.off('pipeline:complete', onComplete);
      eventBus.off('pipeline:retry', onRetry);
      eventBus.off('pipeline:improvement', onImprovement);
      eventBus.off('pipeline:approval_needed', onApprovalNeeded);
      eventBus.off('agent:tool_call', onToolCall);
      eventBus.off('agent:tool_result', onToolResult);
      eventBus.off('cost:update', onCostUpdate);
      eventBus.off('agent:thinking', onThinking);
    };
  }, [
    addMessage,
    setPipelineStage,
    setActiveAgent,
    setActiveTool,
    setProcessing,
    completeStage,
    failStage,
    clearPipeline,
    setApproval,
    setCost,
  ]);

  return {
    pipelineStage: state.pipelineStage,
    activeAgent: state.activeAgent,
    activeTool: state.activeTool,
    isProcessing: state.isProcessing,
    completedStages: state.completedStages,
    failedStage: state.failedStage,
    approvalCallback: state.approvalCallback,
    approvalSummary: state.approvalSummary,
    cost: state.cost,
    tokenCount: state.tokenCount,
  };
}
