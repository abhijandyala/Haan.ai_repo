import { eventBus } from '../utils/event-bus.js';
import { logger } from '../utils/logger.js';
import { createAgent, AgentName } from './agent-registry.js';
import { BaseAgent } from './base-agent.js';
import { AgentContext, AgentOutput } from './types.js';

/**
 * Sub-task descriptor produced by the planner for parallel execution.
 */
export interface SubTask {
  id: string;
  description: string;
  agentName: AgentName;
  dependsOn: string[]; // IDs of sub-tasks that must complete first
}

/**
 * Result of a completed sub-task.
 */
interface SubTaskResult {
  id: string;
  output: AgentOutput;
}

/**
 * Manages parallel execution of sub-tasks across multiple agent instances.
 *
 * Workflow:
 *   1. Planner decomposes a task into SubTasks with a dependency graph
 *   2. Coordinator groups independent sub-tasks into levels
 *   3. Each level runs in parallel via Promise.all
 *   4. Results are merged and returned to the pipeline
 */
export class AgentCoordinator {
  private results: Map<string, SubTaskResult> = new Map();

  /**
   * Execute a set of sub-tasks respecting their dependency graph.
   * Returns all results keyed by sub-task ID.
   */
  async execute(
    subTasks: SubTask[],
    context: AgentContext,
  ): Promise<Map<string, AgentOutput>> {
    this.results.clear();
    const levels = this.buildExecutionLevels(subTasks);

    logger.info('coordinator', `Executing ${subTasks.length} sub-tasks across ${levels.length} levels`);

    for (let levelIdx = 0; levelIdx < levels.length; levelIdx++) {
      const group = levels[levelIdx];
      logger.info('coordinator', `Level ${levelIdx}: ${group.map(t => t.id).join(', ')}`);

      const promises = group.map(subTask => this.runSubTask(subTask, context));
      const results = await Promise.all(promises);

      for (const result of results) {
        this.results.set(result.id, result);
      }
    }

    const outputs = new Map<string, AgentOutput>();
    for (const [id, result] of this.results) {
      outputs.set(id, result.output);
    }
    return outputs;
  }

  /**
   * Run a single sub-task using the specified agent.
   */
  private async runSubTask(
    subTask: SubTask,
    context: AgentContext,
  ): Promise<SubTaskResult> {
    logger.info('coordinator', `Starting sub-task: ${subTask.id} (${subTask.agentName})`);

    try {
      const agent = createAgent(subTask.agentName);

      // Build enhanced task with context from dependency outputs
      let enhancedTask = subTask.description;
      if (subTask.dependsOn.length > 0) {
        const depContext: string[] = [subTask.description, '', 'Context from completed sub-tasks:'];
        for (const depId of subTask.dependsOn) {
          const depResult = this.results.get(depId);
          if (depResult) {
            depContext.push(`\n--- ${depId} (${depResult.output.success ? 'success' : 'failed'}) ---`);
            depContext.push(depResult.output.content.slice(0, 1500));
          }
        }
        enhancedTask = depContext.join('\n');
      }

      const output = await agent.run(enhancedTask, context);

      logger.info('coordinator', `Sub-task ${subTask.id} completed (success: ${output.success})`);
      return { id: subTask.id, output };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error('coordinator', `Sub-task ${subTask.id} failed: ${errorMsg}`);
      return {
        id: subTask.id,
        output: {
          success: false,
          content: `Sub-task error: ${errorMsg}`,
          toolCallsMade: 0,
          tokensUsed: { input: 0, output: 0 },
        },
      };
    }
  }

  /**
   * Group sub-tasks into execution levels based on their dependency graph.
   * Sub-tasks with no unresolved dependencies go in the earliest possible level.
   */
  private buildExecutionLevels(subTasks: SubTask[]): SubTask[][] {
    const levels: SubTask[][] = [];
    const completed = new Set<string>();
    const remaining = new Set(subTasks.map(t => t.id));
    const taskMap = new Map(subTasks.map(t => [t.id, t]));

    while (remaining.size > 0) {
      const currentLevel: SubTask[] = [];

      for (const id of remaining) {
        const task = taskMap.get(id)!;
        const allDepsMet = task.dependsOn.every(dep => completed.has(dep));
        if (allDepsMet) {
          currentLevel.push(task);
        }
      }

      if (currentLevel.length === 0) {
        // Circular dependency or unresolvable — force remaining into final level
        logger.warn('coordinator', `Unresolvable dependencies detected. Forcing remaining tasks.`);
        for (const id of remaining) {
          currentLevel.push(taskMap.get(id)!);
        }
      }

      for (const task of currentLevel) {
        remaining.delete(task.id);
        completed.add(task.id);
      }

      levels.push(currentLevel);
    }

    return levels;
  }

  /**
   * Parse planner output to extract sub-tasks for parallel execution.
   * Expected format from planner:
   * { "subtasks": [{ "id": "auth", "description": "...", "agent": "builder", "dependsOn": [] }] }
   */
  static parseSubTasks(plannerOutput: unknown): SubTask[] | null {
    if (!plannerOutput || typeof plannerOutput !== 'object') return null;

    const obj = plannerOutput as Record<string, unknown>;
    const subtasks = obj.subtasks || obj.subTasks || obj.sub_tasks;

    if (!Array.isArray(subtasks)) return null;

    return subtasks.map((s: Record<string, unknown>, idx: number) => ({
      id: String(s.id || `task-${idx}`),
      description: String(s.description || s.task || ''),
      agentName: (String(s.agent || s.agentName || 'builder') as AgentName),
      dependsOn: Array.isArray(s.dependsOn) ? s.dependsOn.map(String) : [],
    }));
  }
}
