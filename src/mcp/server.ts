import { PipelineEngine } from '../pipeline/pipeline-engine.js';
import { PipelineStage } from '../pipeline/types.js';
import { toolRegistry } from '../tools/tool-registry.js';
import { executeTool } from '../tools/tool-executor.js';
import { registerAllTools } from '../tools/index.js';
import { eventBus } from '../utils/event-bus.js';
import { logger } from '../utils/logger.js';

interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

interface McpToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

interface McpToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

/**
 * Haan.ai MCP Server — exposes pipeline execution and tools via
 * Model Context Protocol over stdio.
 *
 * Protocol: JSON-RPC 2.0 over stdin/stdout (one JSON object per line).
 *
 * Supported methods:
 *   - initialize
 *   - tools/list
 *   - tools/call
 *   - resources/list
 *   - resources/read
 */
export class HaanMcpServer {
  private pipeline: PipelineEngine;
  private initialized = false;

  constructor() {
    registerAllTools();
    this.pipeline = new PipelineEngine();
  }

  /**
   * Start listening on stdin for JSON-RPC messages.
   */
  async start(): Promise<void> {
    logger.info('mcp-server', 'Starting MCP server on stdio');

    process.stdin.setEncoding('utf-8');
    let buffer = '';

    process.stdin.on('data', (chunk: string) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          this.handleMessage(line.trim()).catch(err => {
            logger.error('mcp-server', `Message handling error: ${(err as Error).message}`);
          });
        }
      }
    });

    process.stdin.on('end', () => {
      logger.info('mcp-server', 'Stdin closed, shutting down');
      process.exit(0);
    });
  }

  private async handleMessage(raw: string): Promise<void> {
    let request: { jsonrpc: string; id?: number | string; method: string; params?: Record<string, unknown> };

    try {
      request = JSON.parse(raw);
    } catch {
      this.sendError(null, -32700, 'Parse error');
      return;
    }

    const { id, method, params } = request;

    try {
      switch (method) {
        case 'initialize':
          this.sendResult(id, {
            protocolVersion: '2024-11-05',
            serverInfo: { name: 'haan-ai', version: '1.0.0' },
            capabilities: {
              tools: {},
              resources: {},
            },
          });
          this.initialized = true;
          break;

        case 'notifications/initialized':
          // Client acknowledgement — no response needed
          break;

        case 'tools/list':
          this.sendResult(id, { tools: this.getToolDefinitions() });
          break;

        case 'tools/call':
          const toolResult = await this.callTool(params as unknown as McpToolCall);
          this.sendResult(id, toolResult);
          break;

        case 'resources/list':
          this.sendResult(id, { resources: this.getResourceDefinitions() });
          break;

        case 'resources/read':
          const resourceResult = await this.readResource(params?.uri as string);
          this.sendResult(id, resourceResult);
          break;

        default:
          this.sendError(id, -32601, `Method not found: ${method}`);
      }
    } catch (err) {
      this.sendError(id, -32603, `Internal error: ${(err as Error).message}`);
    }
  }

  private getToolDefinitions(): McpToolDefinition[] {
    return [
      {
        name: 'haan_run_pipeline',
        description: 'Run the full PLAN->BUILD->TEST->REVIEW pipeline on a coding task',
        inputSchema: {
          type: 'object',
          properties: {
            task: { type: 'string', description: 'The coding task to execute' },
            mode: { type: 'string', enum: ['auto', 'human'], description: 'Execution mode (default: auto)' },
          },
          required: ['task'],
        },
      },
      {
        name: 'haan_run_stage',
        description: 'Run a single pipeline stage (plan, build, test, debug, or review)',
        inputSchema: {
          type: 'object',
          properties: {
            task: { type: 'string', description: 'The coding task' },
            stage: { type: 'string', enum: ['planning', 'building', 'testing', 'debugging', 'reviewing'] },
          },
          required: ['task', 'stage'],
        },
      },
      {
        name: 'haan_execute_tool',
        description: 'Execute a Haan tool directly (file-read, shell-exec, git-diff, etc.)',
        inputSchema: {
          type: 'object',
          properties: {
            tool: { type: 'string', description: 'Tool name (e.g., file-read, shell-exec)' },
            args: { type: 'object', description: 'Tool arguments' },
          },
          required: ['tool'],
        },
      },
      {
        name: 'haan_get_status',
        description: 'Get current pipeline status and cost information',
        inputSchema: { type: 'object', properties: {} },
      },
    ];
  }

  private async callTool(call: McpToolCall): Promise<McpToolResult> {
    switch (call.name) {
      case 'haan_run_pipeline': {
        const task = call.arguments.task as string;
        const mode = (call.arguments.mode as 'auto' | 'human') || 'auto';

        const state = await this.pipeline.execute({ task, mode });
        const outputs: Record<string, unknown> = {};
        for (const [stage, output] of state.outputs) {
          outputs[stage] = {
            success: output.success,
            content: output.content.slice(0, 2000),
            duration: output.duration,
          };
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              status: state.currentStage,
              task: state.task,
              outputs,
              retries: state.retryCount,
              error: state.error,
            }, null, 2),
          }],
        };
      }

      case 'haan_run_stage': {
        const task = call.arguments.task as string;
        const stageStr = call.arguments.stage as string;
        const stage = stageStr as PipelineStage;
        const validStages = [PipelineStage.PLANNING, PipelineStage.BUILDING, PipelineStage.TESTING, PipelineStage.DEBUGGING, PipelineStage.REVIEWING];
        if (!validStages.includes(stage)) {
          return { content: [{ type: 'text', text: `Invalid stage: ${stageStr}` }], isError: true };
        }

        const state = await this.pipeline.execute({ task, mode: 'auto', stages: [stage] });
        const output = state.outputs.get(stage);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              stage,
              success: output?.success,
              content: output?.content.slice(0, 3000),
              duration: output?.duration,
            }, null, 2),
          }],
        };
      }

      case 'haan_execute_tool': {
        const toolName = call.arguments.tool as string;
        const args = (call.arguments.args || {}) as Record<string, unknown>;

        if (!toolRegistry.has(toolName)) {
          return { content: [{ type: 'text', text: `Unknown tool: ${toolName}. Available: ${toolRegistry.names().join(', ')}` }], isError: true };
        }

        const result = await executeTool(toolName, args, 'mcp');
        return {
          content: [{ type: 'text', text: result.output }],
          isError: result.isError,
        };
      }

      case 'haan_get_status': {
        const state = this.pipeline.getState();
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              stage: state.currentStage,
              task: state.task,
              mode: state.mode,
              retries: state.retryCount,
              tools: toolRegistry.names(),
            }, null, 2),
          }],
        };
      }

      default:
        return { content: [{ type: 'text', text: `Unknown tool: ${call.name}` }], isError: true };
    }
  }

  private getResourceDefinitions() {
    return [
      {
        uri: 'haan://tools',
        name: 'Available Tools',
        description: 'List of all registered Haan tools and their schemas',
        mimeType: 'application/json',
      },
      {
        uri: 'haan://pipeline/state',
        name: 'Pipeline State',
        description: 'Current pipeline execution state',
        mimeType: 'application/json',
      },
    ];
  }

  private async readResource(uri: string) {
    switch (uri) {
      case 'haan://tools':
        return {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(toolRegistry.getSchemas(), null, 2),
          }],
        };

      case 'haan://pipeline/state':
        const state = this.pipeline.getState();
        const stateObj: Record<string, unknown> = {
          currentStage: state.currentStage,
          task: state.task,
          mode: state.mode,
          retryCount: state.retryCount,
        };
        return {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(stateObj, null, 2),
          }],
        };

      default:
        throw new Error(`Unknown resource: ${uri}`);
    }
  }

  private sendResult(id: number | string | undefined | null, result: unknown): void {
    if (id == null) return; // Notification, no response needed
    const msg = JSON.stringify({ jsonrpc: '2.0', id, result });
    process.stdout.write(msg + '\n');
  }

  private sendError(id: number | string | undefined | null, code: number, message: string): void {
    const msg = JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } });
    process.stdout.write(msg + '\n');
  }
}
