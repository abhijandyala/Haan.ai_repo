import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { PipelineStage, StageOutput } from './types.js';
import { createAgent, AgentName } from '../agents/agent-registry.js';
import { AgentContext } from '../agents/types.js';
import { getProjectRoot } from '../utils/path-utils.js';
import { eventBus } from '../utils/event-bus.js';
import { logger } from '../utils/logger.js';
import { MemoryManager } from '../memory/memory-manager.js';
import { validateStageOutput } from './stage-schemas.js';
import { detectFramework, ProjectFramework } from '../agents/framework-detector.js';

let cachedFramework: ProjectFramework | undefined;

const STAGE_TO_AGENT: Record<string, AgentName> = {
  [PipelineStage.PLANNING]: 'planner',
  [PipelineStage.BUILDING]: 'builder',
  [PipelineStage.TESTING]: 'tester',
  [PipelineStage.DEBUGGING]: 'debugger',
  [PipelineStage.REVIEWING]: 'feature-engineer',
};

/**
 * Run a single pipeline stage.
 */
export async function runStage(
  stage: PipelineStage,
  task: string,
  previousOutputs: Map<PipelineStage, StageOutput>,
  memory: MemoryManager,
): Promise<StageOutput> {
  const startTime = Date.now();
  const agentName = STAGE_TO_AGENT[stage];

  if (!agentName) {
    throw new Error(`No agent mapping for stage: ${stage}`);
  }

  eventBus.emit('pipeline:stage_start', { stage, agent: agentName });
  logger.info('StageRunner', `Starting stage: ${stage} with agent: ${agentName}`);

  try {
    const agent = createAgent(agentName);

    // Build context from previous outputs
    const prevOutputObj: Record<string, unknown> = {};
    for (const [s, output] of previousOutputs) {
      prevOutputObj[s] = {
        success: output.success,
        content: output.content,
        structured: output.structured,
      };
    }

    // Build task with context from previous stages
    let enhancedTask = task;

    // For improvement passes: give the builder a focused task from review feedback
    const reviewOutput = previousOutputs.get(PipelineStage.REVIEWING);
    if (stage === PipelineStage.BUILDING && reviewOutput?.structured) {
      const reviewData = reviewOutput.structured as Record<string, unknown>;
      if (reviewData.approved === false || (reviewData.issues && Array.isArray(reviewData.issues) && (reviewData.issues as unknown[]).length > 0)) {
        enhancedTask = buildImprovementTask(task, reviewOutput);
      }
    }

    if (enhancedTask === task && previousOutputs.size > 0) {
      const contextParts: string[] = [`Original task: ${task}`, '', 'Previous stage outputs:'];
      for (const [s, output] of previousOutputs) {
        contextParts.push(`\n--- ${s.toUpperCase()} (${output.success ? 'passed' : 'FAILED'}) ---`);
        contextParts.push(output.content.slice(0, 1500));
      }
      enhancedTask = contextParts.join('\n');
    }

    // Detect framework once and cache
    if (!cachedFramework) {
      cachedFramework = detectFramework(getProjectRoot());
    }

    const context: AgentContext = {
      projectRoot: getProjectRoot(),
      projectInfo: buildProjectInfo(),
      workingMemory: memory.getWorkingState('context') as Record<string, unknown> || {},
      previousOutputs: prevOutputObj,
      mode: 'auto',
      framework: cachedFramework,
    };

    const result = await agent.run(enhancedTask, context);
    const duration = Date.now() - startTime;

    // Validate structured output against schema
    let success = result.success;
    if (success && result.structured) {
      const validation = validateStageOutput(stage, result.structured);
      if (!validation.valid) {
        logger.warn('StageRunner', `Stage ${stage} output failed schema validation`, { errors: validation.errors });
        eventBus.emit('pipeline:validation_error', { stage, errors: validation.errors });
        // Don't fail the stage for validation errors — it's a soft warning
        // The structured data might be partially valid
      }
    }

    // For building stage, validate that files were actually created/modified
    if (stage === PipelineStage.BUILDING && success) {
      const structured = result.structured as Record<string, unknown> | undefined;
      if (structured) {
        const created = Array.isArray(structured.filesCreated) ? structured.filesCreated : [];
        const modified = Array.isArray(structured.filesModified) ? structured.filesModified : [];
        if (created.length === 0 && modified.length === 0) {
          logger.warn('StageRunner', 'Builder reported success but created/modified zero files — marking as failure');
          success = false;
        }
      }
    }

    // For testing stage, check test results for pass/fail using smarter detection
    if (stage === PipelineStage.TESTING) {
      const content = result.content;
      const lower = content.toLowerCase();

      // Check for numbered failure indicators: "5 failed", "3 errors"
      const failureCountRegex = /(?:^|\s)(\d+)\s+(?:fail(?:ed|ures?)?|errors?)/gmi;
      let match;
      let hasNumberedFailures = false;
      let hasZeroFailures = false;
      while ((match = failureCountRegex.exec(lower)) !== null) {
        const count = parseInt(match[1], 10);
        if (count > 0) {
          hasNumberedFailures = true;
        } else {
          hasZeroFailures = true;
        }
      }

      // Check for failure symbols and explicit keywords
      const hasSymbolicFailures =
          content.includes('\u2717') || // ✗
          content.includes('\u2716') || // ✖
          /FAIL(?:ED|URE|ING)\b/i.test(content) ||
          /tests?\s+failed/i.test(content) ||
          /exit\s+code\s+[1-9]/i.test(content);

      // Mark as failure if there are real failure indicators,
      // UNLESS the only match is "0 failed" with no other signals
      if (hasNumberedFailures) {
        success = false;
      } else if (hasSymbolicFailures && !hasZeroFailures) {
        success = false;
      }
    }

    const output: StageOutput = {
      stage,
      success,
      content: result.content,
      structured: result.structured,
      duration,
      tokensUsed: result.tokensUsed,
    };

    // Save to working memory
    memory.saveWorkingState(`stage_${stage}`, {
      content: result.content,
      structured: result.structured,
      success,
    });

    if (success) {
      eventBus.emit('pipeline:stage_complete', { stage, output });
    } else {
      eventBus.emit('pipeline:stage_error', { stage, error: result.content.slice(0, 300) });
    }

    logger.info('StageRunner', `Stage ${stage} completed in ${duration}ms (success: ${success})`);
    return output;

  } catch (err) {
    const duration = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : undefined;

    logger.error('StageRunner', `Stage ${stage} failed: ${errorMsg}`, {
      stage,
      agent: agentName,
      duration,
      stack: errorStack,
    });

    eventBus.emit('pipeline:stage_error', { stage, error: errorMsg });

    // Provide actionable error context
    let content = `Agent error in ${stage} stage (${agentName}): ${errorMsg}`;
    if (errorMsg.includes('API key')) {
      content += '\n\nFix: Set the required API key as an environment variable or via /config.';
    } else if (errorMsg.includes('timed out')) {
      content += '\n\nFix: Increase the timeout via /config pipeline.timeout <ms> or simplify the task.';
    } else if (errorMsg.includes('Unknown model')) {
      content += '\n\nFix: Update the model via /model <role> <model-id>. Run /doctor to check setup.';
    }

    return {
      stage,
      success: false,
      content,
      duration,
      tokensUsed: { input: 0, output: 0 },
    };
  }
}

function buildProjectInfo(): string {
  const root = getProjectRoot();
  const lines: string[] = [`Project root: ${root}`];

  try {
    const pkgPath = path.join(root, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      lines.push(`Name: ${pkg.name || 'unnamed'}`);
      lines.push(`Type: ${pkg.type || 'commonjs'}`);
      if (pkg.dependencies) lines.push(`Deps: ${Object.keys(pkg.dependencies).slice(0, 10).join(', ')}`);
    }
  } catch { /* ignore */ }

  try {
    const count = execSync(`find "${root}" -type f -not -path "*/node_modules/*" -not -path "*/.git/*" | wc -l`, {
      encoding: 'utf-8', timeout: 5000
    }).trim();
    lines.push(`Files: ${count}`);
  } catch { /* ignore */ }

  return lines.join('\n');
}

/**
 * Build a focused task for the builder during improvement passes.
 * Uses the reviewer's specific issues instead of dumping the full pipeline history.
 */
function buildImprovementTask(originalTask: string, reviewOutput: StageOutput): string {
  const parts: string[] = [`Original task: ${originalTask}`, ''];
  const structured = reviewOutput.structured as Record<string, unknown> | undefined;

  parts.push('## Review Feedback \u2014 Fix These Issues');
  parts.push(`Score: ${structured?.score ?? 'unknown'}/10`);

  const blockers = structured?.blockers as string[] | undefined;
  if (blockers?.length) {
    parts.push('\n### Blockers (MUST fix):');
    blockers.forEach((b, i) => parts.push(`${i + 1}. ${b}`));
  }

  const issues = structured?.issues as Array<Record<string, unknown>> | undefined;
  if (issues?.length) {
    parts.push('\n### Issues:');
    for (let i = 0; i < issues.length; i++) {
      const issue = issues[i];
      parts.push(`${i + 1}. [${issue.severity}] ${issue.file}: ${issue.description}`);
      if (issue.suggestion) parts.push(`   Fix: ${issue.suggestion}`);
    }
  }

  const suggestions = structured?.suggestions as Array<Record<string, unknown>> | undefined;
  if (suggestions?.length) {
    parts.push('\n### Suggestions:');
    for (let i = 0; i < Math.min(suggestions.length, 5); i++) {
      const s = suggestions[i];
      parts.push(`${i + 1}. [${s.priority}] ${s.file}: ${s.description}`);
    }
  }

  parts.push('\nFix ALL blockers and high-severity issues. Then run the build to verify.');
  return parts.join('\n');
}
