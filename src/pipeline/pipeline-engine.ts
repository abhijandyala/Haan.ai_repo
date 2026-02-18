import { execSync } from 'child_process';
import {
  PipelineStage,
  PipelineState,
  PipelineOptions,
  StageOutput,
  StageDependency,
  DEFAULT_PIPELINE_STAGES,
  DEFAULT_PIPELINE_DAG,
} from './types.js';
import { PipelineDAG } from './dag.js';
import { runStage } from './stage-runner.js';
import { saveCheckpoint, loadCheckpoint, restoreFromCheckpoint, removeCheckpoint } from './checkpoint.js';
import { shouldRetry, getBackoffMs, sleep } from './retry-strategy.js';
import { MemoryManager } from '../memory/memory-manager.js';
import { getConfig } from '../config/config-manager.js';
import { getProjectRoot } from '../utils/path-utils.js';
import { eventBus } from '../utils/event-bus.js';
import { logger } from '../utils/logger.js';
import { costTracker, BudgetExceededError } from '../utils/cost-tracker.js';

/**
 * The main pipeline state machine.
 *
 * Full pipeline flow:
 *   PLANNING -> BUILDING -> TESTING -> (pass) -> REVIEWING -> COMPLETE
 *                                      (fail) -> DEBUGGING -> BUILDING -> TESTING (retry loop, max N)
 *
 * Supports:
 * - Partial pipelines (specific stages via options.stages)
 * - Human-aided mode (approval gates between stages)
 * - Automatic retry with debug loop on test failure
 */
export class PipelineEngine {
  private state: PipelineState;
  private memory: MemoryManager;
  private stageTimeout: number = 300_000;
  private hasGit: boolean;

  constructor() {
    this.state = this.createInitialState('');
    this.memory = new MemoryManager(getProjectRoot());
    // Check if git is available
    this.hasGit = (() => {
      try {
        execSync('git rev-parse --is-inside-work-tree', { cwd: getProjectRoot(), stdio: 'pipe' });
        return true;
      } catch {
        return false;
      }
    })();
  }

  /**
   * Execute the pipeline for the given options.
   * Returns the final pipeline state.
   */
  async execute(options: PipelineOptions): Promise<PipelineState> {
    const config = getConfig();
    const maxRetries = options.maxRetries ?? config.pipeline.maxRetries;
    const maxImprovementPasses = config.pipeline.maxImprovementPasses ?? 2;
    this.stageTimeout = config.pipeline.timeout || 300_000;

    // Initialize state
    this.state = this.createInitialState(options.task, options.mode, maxRetries, maxImprovementPasses);
    this.memory.clearWorkingState();

    // Set up budget if configured
    if (config.budget) {
      costTracker.setBudget(config.budget);
    }
    costTracker.resetTaskCost();

    logger.info('PipelineEngine', `Starting pipeline for task: "${options.task}" in ${options.mode} mode`);

    // Resume from checkpoint if provided
    let stages = options.stages ?? DEFAULT_PIPELINE_STAGES;
    if (options.checkpointPath) {
      const checkpoint = loadCheckpoint(options.checkpointPath);
      if (checkpoint) {
        const restored = restoreFromCheckpoint(checkpoint);
        // Merge restored state
        this.state.retryCount = restored.state.retryCount ?? 0;
        this.state.improvementPass = restored.state.improvementPass ?? 0;
        for (const [stage, output] of restored.outputs) {
          this.state.outputs.set(stage, output);
        }
        // Filter out already-completed stages
        const completedSet = new Set(restored.completedStages);
        stages = stages.filter(s => !completedSet.has(s));
        logger.info('PipelineEngine', `Resumed from checkpoint. Skipping: ${[...completedSet].join(', ')}. Remaining: ${stages.join(', ')}`);
      }
    }

    const dagDeps = this.buildDAGForStages(stages);

    try {
      await this.runStagesDAG(dagDeps);
      // Clean up checkpoint on success
      removeCheckpoint(options.task);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const errorStack = err instanceof Error ? err.stack : undefined;
      this.state.currentStage = PipelineStage.FAILED;
      this.state.error = errorMsg;

      if (err instanceof BudgetExceededError) {
        logger.warn('PipelineEngine', `Pipeline stopped: ${errorMsg}`);
        eventBus.emit('pipeline:complete', {
          success: false,
          summary: `Pipeline stopped: **${errorMsg}**\n\nAdjust budget limits via \`/config budget.perTaskLimit <amount>\` or \`/config budget.dailyLimit <amount>\`.`,
        });
      } else {
        logger.error('PipelineEngine', `Pipeline failed: ${errorMsg}`, { stack: errorStack });
        eventBus.emit('pipeline:complete', {
          success: false,
          summary: `Pipeline failed: ${errorMsg}\n\nRun \`/logs --errors\` for full details.`,
        });
      }
    }

    return this.state;
  }

  /** Get the current pipeline state (read-only snapshot). */
  getState(): PipelineState {
    return { ...this.state, outputs: new Map(this.state.outputs) };
  }

  /**
   * Build a DAG from a flat list of stages.
   * Uses the default DAG dependencies, filtered to the requested stages.
   */
  private buildDAGForStages(stages: PipelineStage[]): StageDependency[] {
    const dag = new PipelineDAG(DEFAULT_PIPELINE_DAG);
    return dag.filterStages(stages);
  }

  /**
   * Run stages respecting the dependency graph.
   * Independent stages within the same level run in parallel.
   * Handles the test-failure retry loop and improvement passes.
   */
  private async runStagesDAG(deps: StageDependency[]): Promise<void> {
    const dag = new PipelineDAG(deps);
    const levels = dag.getExecutionLevels();

    for (let levelIdx = 0; levelIdx < levels.length; levelIdx++) {
      const group = levels[levelIdx];

      if (group.length > 1) {
        eventBus.emit('pipeline:parallel_group', { stages: group, level: levelIdx });
        logger.info('PipelineEngine', `Parallel group ${levelIdx}: ${group.join(', ')}`);
      }

      // Run all stages in this level concurrently
      const results = await Promise.all(
        group.map(stage => this.runSingleStage(stage)),
      );

      // Check results for failures
      for (let i = 0; i < group.length; i++) {
        const stage = group[i];
        const output = results[i];

        if (output === null) {
          // Stage was rejected by user in human-aided mode
          return;
        }

        if (output.success) {
          // Review-driven improvement loop
          if (stage === PipelineStage.REVIEWING) {
            const structured = output.structured as Record<string, unknown> | undefined;
            const score = Number(structured?.score ?? 10);
            const approved = structured?.approved !== false;

            if (!approved && score < 8 && this.state.improvementPass < this.state.maxImprovementPasses) {
              this.state.improvementPass++;

              logger.info('PipelineEngine', `Improvement pass ${this.state.improvementPass}/${this.state.maxImprovementPasses} (score: ${score}/10)`);

              eventBus.emit('pipeline:improvement', {
                pass: this.state.improvementPass,
                score,
                issues: (structured?.issues as unknown[]) || [],
              });

              // Re-run BUILD -> TEST -> REVIEW as improvement cycle
              const improvementDeps: StageDependency[] = [
                { stage: PipelineStage.BUILDING, dependsOn: [] },
                { stage: PipelineStage.TESTING, dependsOn: [PipelineStage.BUILDING] },
                { stage: PipelineStage.REVIEWING, dependsOn: [PipelineStage.TESTING] },
              ];
              await this.runStagesDAG(improvementDeps);
              return;
            }
          }
          continue;
        }

        // Stage failed
        if (stage === PipelineStage.TESTING) {
          const recovered = await this.handleTestFailure(output);
          if (!recovered) {
            this.state.currentStage = PipelineStage.FAILED;
            this.state.error = `Tests failed after ${this.state.retryCount} retries`;
            const lastTestOutput = this.state.outputs.get(PipelineStage.TESTING);
            const failurePreview = lastTestOutput?.content.slice(0, 500) || output.content.slice(0, 500);
            eventBus.emit('pipeline:complete', {
              success: false,
              summary: `Pipeline failed: tests did not pass after **${this.state.retryCount} retries** (debug-build-test loop).\n\n**Last test output:**\n${failurePreview}\n\nRun \`/logs --errors\` for full details.`,
            });
            return;
          }
          continue;
        }

        // Non-test stage failed — pipeline fails immediately
        this.state.currentStage = PipelineStage.FAILED;
        this.state.error = `Stage ${stage} failed: ${output.content.slice(0, 500)}`;
        const errorPreview = output.content.slice(0, 500);
        eventBus.emit('pipeline:complete', {
          success: false,
          summary: `Pipeline failed at **${stage.toUpperCase()}** stage.\n\n**Error:** ${errorPreview}\n\n**Duration:** ${output.duration}ms\n**Tokens used:** ${output.tokensUsed.input} in / ${output.tokensUsed.output} out\n\nRun \`/logs --errors\` for full details.`,
        });
        return;
      }
    }

    // All stages completed successfully
    this.state.currentStage = PipelineStage.COMPLETE;
    eventBus.emit('pipeline:complete', {
      success: true,
      summary: this.buildCompletionSummary(),
    });
    logger.info('PipelineEngine', 'Pipeline completed successfully');
  }

  /**
   * Run a single stage with human-aided approval and timeout.
   * Returns null if the user rejected the stage.
   */
  private async runSingleStage(stage: PipelineStage): Promise<StageOutput | null> {
    this.state.currentStage = stage;

    if (this.state.mode === 'human') {
      const summary = this.buildApprovalSummary(stage);
      const approved = await this.waitForApproval(stage, summary);
      if (!approved) {
        this.state.currentStage = PipelineStage.FAILED;
        this.state.error = `User rejected stage: ${stage}`;
        eventBus.emit('pipeline:complete', {
          success: false,
          summary: `Pipeline stopped: user rejected ${stage} stage`,
        });
        return null;
      }
    }

    const output = await this.runStageWithTimeout(stage);
    this.state.outputs.set(stage, output);

    // Save checkpoint after each stage completes
    try {
      const checkpointPath = saveCheckpoint(this.state);
      eventBus.emit('pipeline:checkpoint', { stage, path: checkpointPath });
    } catch (err) {
      logger.warn('PipelineEngine', `Failed to save checkpoint after ${stage}`, err);
    }

    return output;
  }

  /**
   * Run a stage with timeout protection via Promise.race.
   */
  private async runStageWithTimeout(stage: PipelineStage): Promise<StageOutput> {
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<StageOutput>((_, reject) => {
      timeoutHandle = setTimeout(
        () => reject(new Error(`Stage '${stage}' timed out after ${this.stageTimeout}ms`)),
        this.stageTimeout,
      );
    });

    try {
      const result = await Promise.race([
        runStage(stage, this.state.task, this.state.outputs, this.memory),
        timeoutPromise,
      ]);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('PipelineEngine', `Stage timeout/error: ${msg}`);
      return {
        stage,
        success: false,
        content: msg,
        duration: this.stageTimeout,
        tokensUsed: { input: 0, output: 0 },
      };
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  }

  /**
   * Handle test failure with debug -> rebuild -> re-test loop.
   * Returns true if tests eventually pass, false if max retries exceeded.
   */
  private async handleTestFailure(failedTestOutput: StageOutput): Promise<boolean> {
    // Git stash: save working state before retry loop
    const stashed = this.gitStash();

    try {
      while (shouldRetry(this.state)) {
        this.state.retryCount++;

        eventBus.emit('pipeline:retry', {
          stage: PipelineStage.TESTING,
          attempt: this.state.retryCount,
          maxRetries: this.state.maxRetries,
        });

        logger.info(
          'PipelineEngine',
          `Test failure retry ${this.state.retryCount}/${this.state.maxRetries}`,
        );

        // Backoff before retry
        const backoff = getBackoffMs(this.state.retryCount - 1);
        await sleep(backoff);

        // 1. DEBUGGING stage: analyze test failures
        this.state.currentStage = PipelineStage.DEBUGGING;

        if (this.state.mode === 'human') {
          const approved = await this.waitForApproval(
            PipelineStage.DEBUGGING,
            `Tests failed. Starting debug attempt ${this.state.retryCount}/${this.state.maxRetries}.\nFailure output: ${failedTestOutput.content.slice(0, 300)}`,
          );
          if (!approved) return false;
        }

        const debugOutput = await this.runStageWithTimeout(PipelineStage.DEBUGGING);
        this.state.outputs.set(PipelineStage.DEBUGGING, debugOutput);

        if (!debugOutput.success) {
          logger.warn('PipelineEngine', 'Debug stage failed, continuing to rebuild anyway');
        }

        // 2. BUILDING stage: rebuild with debug insights
        this.state.currentStage = PipelineStage.BUILDING;

        if (this.state.mode === 'human') {
          const approved = await this.waitForApproval(
            PipelineStage.BUILDING,
            `Rebuilding after debug analysis.\n${debugOutput.content.slice(0, 300)}`,
          );
          if (!approved) return false;
        }

        const buildOutput = await this.runStageWithTimeout(PipelineStage.BUILDING);
        this.state.outputs.set(PipelineStage.BUILDING, buildOutput);

        if (!buildOutput.success) {
          logger.warn('PipelineEngine', 'Rebuild failed, moving to next retry');
          failedTestOutput = buildOutput;
          continue;
        }

        // 3. TESTING stage: re-test
        this.state.currentStage = PipelineStage.TESTING;

        if (this.state.mode === 'human') {
          const approved = await this.waitForApproval(
            PipelineStage.TESTING,
            'Re-running tests after rebuild.',
          );
          if (!approved) return false;
        }

        const testOutput = await this.runStageWithTimeout(PipelineStage.TESTING);
        this.state.outputs.set(PipelineStage.TESTING, testOutput);

        if (testOutput.success) {
          logger.info('PipelineEngine', `Tests passed on retry ${this.state.retryCount}`);
          return true;
        }

        // Update for next iteration
        failedTestOutput = testOutput;
      }

      return false;
    } finally {
      // Restore stashed changes if we stashed
      if (stashed) this.gitStashPop();
    }
  }

  /**
   * Git stash working changes before retry loops.
   * Returns true if something was stashed.
   */
  private gitStash(): boolean {
    if (!this.hasGit) return false;
    try {
      const root = getProjectRoot();
      const status = execSync('git status --porcelain', { cwd: root, encoding: 'utf-8', stdio: 'pipe' }).trim();
      if (!status) return false;
      execSync('git stash push -m "haan-pipeline-retry-backup"', { cwd: root, stdio: 'pipe' });
      logger.info('PipelineEngine', 'Git stash created before retry loop');
      return true;
    } catch (err) {
      logger.warn('PipelineEngine', `Git stash failed: ${(err as Error).message}`);
      return false;
    }
  }

  /**
   * Restore git stash after retry loop.
   */
  private gitStashPop(): void {
    if (!this.hasGit) return;
    try {
      const root = getProjectRoot();
      execSync('git stash pop', { cwd: root, stdio: 'pipe' });
      logger.info('PipelineEngine', 'Git stash restored after retry loop');
    } catch (err) {
      logger.warn('PipelineEngine', `Git stash pop failed: ${(err as Error).message}`);
    }
  }

  /**
   * Wait for user approval in human-aided mode.
   * Emits a pipeline:approval_needed event and resolves when the user responds.
   * Times out after stageTimeout ms to prevent hanging forever.
   */
  private waitForApproval(stage: string, summary: string): Promise<boolean> {
    return new Promise<boolean>(resolve => {
      let resolved = false;
      const wrappedResolve = (approved: boolean) => {
        if (resolved) return;
        resolved = true;
        resolve(approved);
      };
      // Timeout: auto-reject if no response within stage timeout
      const timer = setTimeout(() => {
        if (!resolved) {
          logger.warn('PipelineEngine', `Approval timeout for stage: ${stage}`);
          wrappedResolve(false);
        }
      }, this.stageTimeout);
      // Clear timer when resolved normally
      const originalResolve = wrappedResolve;
      const resolveAndClear = (approved: boolean) => {
        clearTimeout(timer);
        originalResolve(approved);
      };
      eventBus.emit('pipeline:approval_needed', { stage, summary, resolve: resolveAndClear });
    });
  }

  /**
   * Build a summary for the approval prompt before a stage.
   */
  private buildApprovalSummary(stage: PipelineStage): string {
    const parts: string[] = [`Ready to execute: ${stage.toUpperCase()}`];

    // Include previous stage info if available
    const outputEntries = Array.from(this.state.outputs.entries());
    if (outputEntries.length > 0) {
      const last = outputEntries[outputEntries.length - 1];
      parts.push(`Previous stage (${last[0]}): ${last[1].success ? 'passed' : 'failed'}`);
      parts.push(`Output preview: ${last[1].content.slice(0, 200)}`);
    }

    if (this.state.retryCount > 0) {
      parts.push(`Retry attempt: ${this.state.retryCount}/${this.state.maxRetries}`);
    }

    return parts.join('\n');
  }

  /**
   * Build a summary of the completed pipeline run.
   */
  private buildCompletionSummary(): string {
    const totalDuration = Date.now() - this.state.startTime;
    const totalTokens = { input: 0, output: 0 };

    for (const output of this.state.outputs.values()) {
      totalTokens.input += output.tokensUsed.input;
      totalTokens.output += output.tokensUsed.output;
    }

    const stageResults = Array.from(this.state.outputs.entries())
      .map(([stage, out]) => `  ${stage}: ${out.success ? 'passed' : 'FAILED'} (${out.duration}ms)`)
      .join('\n');

    const lines = [
      `Pipeline completed in ${totalDuration}ms`,
      `Retries used: ${this.state.retryCount}/${this.state.maxRetries}`,
    ];
    if (this.state.improvementPass > 0) {
      lines.push(`Improvement passes: ${this.state.improvementPass}/${this.state.maxImprovementPasses}`);
    }
    lines.push(
      `Total tokens: ${totalTokens.input} in / ${totalTokens.output} out`,
      `Stage results:\n${stageResults}`,
    );
    return lines.join('\n');
  }

  /**
   * Create the initial pipeline state.
   */
  private createInitialState(
    task: string,
    mode: 'auto' | 'human' = 'auto',
    maxRetries: number = 3,
    maxImprovementPasses: number = 2,
  ): PipelineState {
    return {
      currentStage: PipelineStage.IDLE,
      task,
      mode,
      outputs: new Map(),
      retryCount: 0,
      maxRetries,
      improvementPass: 0,
      maxImprovementPasses,
      startTime: Date.now(),
    };
  }
}
