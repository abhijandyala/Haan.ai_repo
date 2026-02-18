import { toolRegistry } from './tool-registry.js';
import { ToolResult } from './types.js';
import { ToolSchema } from '../providers/types.js';
import { logger } from '../utils/logger.js';
import { eventBus } from '../utils/event-bus.js';

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  agentName: string = 'unknown'
): Promise<ToolResult> {
  const tool = toolRegistry.get(name);
  if (!tool) {
    const msg = `Unknown tool: "${name}". Available tools: ${toolRegistry.names().join(', ')}`;
    logger.error('tool-executor', msg);
    return { output: msg, isError: true };
  }

  logger.info('tool-executor', `Executing tool: ${name}`, args);

  try {
    const result = await tool.execute(args);
    logger.info('tool-executor', `Tool ${name} completed`, {
      isError: result.isError,
      outputLength: result.output.length,
    });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('tool-executor', `Tool ${name} threw an error: ${message}`);
    return { output: `Tool execution error: ${message}`, isError: true };
  }
}

/** Execute a tool call and return just the output string (used by BaseAgent) */
export async function executeToolCall(
  name: string,
  args: Record<string, unknown>,
  _context?: { projectRoot: string; workingMemory: Record<string, unknown> }
): Promise<string> {
  const result = await executeTool(name, args);
  return result.output;
}

/** Get tool schemas for a list of tool names (used by BaseAgent) */
export function getToolSchemas(names: string[]): ToolSchema[] {
  return toolRegistry.getSchemas(names) as ToolSchema[];
}

export { toolRegistry };
