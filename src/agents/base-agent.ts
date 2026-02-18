import { EventEmitter } from 'events';
import { IProvider, Message, ToolSchema, StreamChunk, ToolCall } from '../providers/types.js';
import { AgentContext, AgentOutput } from './types.js';
import { eventBus } from '../utils/event-bus.js';
import { logger } from '../utils/logger.js';

// ── Constants ──────────────────────────────────
const TOOL_TIMEOUT_MS = 60_000;          // 60s max per tool call
const MAX_TOOL_OUTPUT = 20_000;          // 20KB per tool result
const STREAM_RETRY_MAX = 3;             // max retries for transient stream errors
const STREAM_RETRY_BASE_MS = 1_000;     // base backoff
const DEFAULT_TOKEN_BUDGET = 110_000;   // default compress threshold
const CHARS_PER_TOKEN = 4;              // rough estimate

export abstract class BaseAgent extends EventEmitter {
  abstract name: string;
  abstract role: string;
  abstract color: string;
  abstract toolNames: string[];

  protected provider: IProvider;
  protected maxIterations: number;
  protected maxContextTokens: number;
  protected enableReflection: boolean = false;
  private _cachedToolSchemas: ToolSchema[] | undefined;

  constructor(
    provider: IProvider,
    maxIterations: number = 25,
    options?: { maxContextTokens?: number; enableReflection?: boolean },
  ) {
    super();
    this.provider = provider;
    this.maxIterations = maxIterations;
    this.maxContextTokens = options?.maxContextTokens ?? DEFAULT_TOKEN_BUDGET;
    this.enableReflection = options?.enableReflection ?? false;
  }

  abstract buildSystemPrompt(context: AgentContext): string;
  abstract parseOutput(content: string): unknown;

  /**
   * Pre-load tool schemas from the tool registry.
   */
  async loadToolSchemas(): Promise<ToolSchema[]> {
    try {
      const { toolRegistry } = await import('../tools/tool-registry.js');
      this._cachedToolSchemas = toolRegistry.getSchemas(this.toolNames) as ToolSchema[];
      return this._cachedToolSchemas;
    } catch {
      logger.warn(this.name, 'Could not load tool schemas - tools may not be available');
      this._cachedToolSchemas = [];
      return [];
    }
  }

  protected getToolSchemas(): ToolSchema[] {
    return this._cachedToolSchemas || [];
  }

  /**
   * The core agentic loop with:
   * - Parallel tool execution
   * - Provider retry with exponential backoff
   * - Context window management (auto-compression)
   * - Per-tool timeout protection
   */
  async run(task: string, context: AgentContext): Promise<AgentOutput> {
    await this.loadToolSchemas();

    const startTime = Date.now();
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalToolCalls = 0;
    let readOnlyIterations = 0;
    const writeToolNames = new Set(['file-write', 'file-edit', 'file-delete']);

    const systemPrompt = this.buildSystemPrompt(context);
    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: task },
    ];

    logger.info(this.name, 'Starting agent run', {
      task: task.substring(0, 200),
      maxIterations: this.maxIterations,
    });

    try {
      for (let iteration = 0; iteration < this.maxIterations; iteration++) {
        logger.debug(this.name, `Iteration ${iteration + 1}/${this.maxIterations}`);
        eventBus.emit('agent:thinking', { agent: this.name, iteration: iteration + 1 });
        this.emit('thinking', { iteration: iteration + 1 });

        // ── Context window management ──
        this.compressIfNeeded(messages);

        // ── Stream with retry ──
        let contentText = '';
        const toolCalls: ToolCall[] = [];
        let currentToolCall: { id: string; name: string; argumentsJson: string; thoughtSignature?: string } | null = null;
        let inputTokens = 0;
        let outputTokens = 0;

        const toolSchemas = this.getToolSchemas();
        const stream = await this.streamWithRetry(
          messages,
          toolSchemas.length > 0 ? toolSchemas : undefined,
        );

        for await (const chunk of stream) {
          switch (chunk.type) {
            case 'reasoning':
              if (chunk.text) {
                eventBus.emit('agent:reasoning', { agent: this.name, text: chunk.text });
                this.emit('reasoning', { text: chunk.text });
              }
              break;

            case 'text':
              if (chunk.text) {
                contentText += chunk.text;
                eventBus.emit('agent:streaming', { agent: this.name, text: chunk.text });
                this.emit('streaming', { text: chunk.text });
              }
              break;

            case 'tool_call_start':
              if (chunk.toolCall) {
                currentToolCall = {
                  id: chunk.toolCall.id || `call_${Date.now()}_${toolCalls.length}`,
                  name: chunk.toolCall.name || '',
                  argumentsJson: '',
                  thoughtSignature: chunk.toolCall.thoughtSignature,
                };
              }
              break;

            case 'tool_call_delta':
              if (currentToolCall) {
                let fragment = '';
                if (chunk.toolCall?.arguments) {
                  fragment = typeof chunk.toolCall.arguments === 'string'
                    ? chunk.toolCall.arguments
                    : JSON.stringify(chunk.toolCall.arguments);
                } else if (chunk.text) {
                  fragment = chunk.text;
                }
                if (fragment) {
                  currentToolCall.argumentsJson += fragment;
                }
              }
              break;

            case 'tool_call_end':
              if (currentToolCall) {
                let parsedArgs: Record<string, unknown> = {};
                const chunkArgs = chunk.toolCall?.arguments;
                if (chunkArgs && typeof chunkArgs === 'object' && Object.keys(chunkArgs).length > 0) {
                  parsedArgs = chunkArgs as Record<string, unknown>;
                } else {
                  try {
                    if (currentToolCall.argumentsJson) {
                      parsedArgs = JSON.parse(currentToolCall.argumentsJson);
                    }
                  } catch {
                    logger.warn(this.name, `Failed to parse tool call arguments for ${currentToolCall.name}`, {
                      raw: currentToolCall.argumentsJson.substring(0, 200),
                    });
                  }
                }
                const finalTc: ToolCall = {
                  id: currentToolCall.id,
                  name: currentToolCall.name,
                  arguments: parsedArgs,
                };
                // Preserve thought signature from provider (Gemini 3)
                const sig = chunk.toolCall?.thoughtSignature || currentToolCall.thoughtSignature;
                if (sig) finalTc.thoughtSignature = sig;
                toolCalls.push(finalTc);
                currentToolCall = null;
              }
              break;

            case 'done':
              if (chunk.usage) {
                inputTokens = chunk.usage.inputTokens;
                outputTokens = chunk.usage.outputTokens;
              }
              break;

            case 'error':
              logger.error(this.name, `Stream error: ${chunk.error}`);
              throw new Error(chunk.error || 'Unknown stream error');
          }
        }

        // Track token usage
        totalInputTokens += inputTokens;
        totalOutputTokens += outputTokens;

        eventBus.emit('cost:update', {
          model: this.provider.model,
          inputTokens,
          outputTokens,
        });

        // ── Tool call branch: execute tools and continue ──
        if (toolCalls.length > 0) {
          messages.push({
            role: 'assistant',
            content: contentText,
            toolCalls,
          });

          // ★ Execute tools in PARALLEL when multiple calls
          const toolResults = await this.executeToolsParallel(toolCalls);

          for (let t = 0; t < toolCalls.length; t++) {
            const tc = toolCalls[t];
            const toolResult = toolResults[t];
            totalToolCalls++;

            let output = toolResult.output;
            if (output.length > MAX_TOOL_OUTPUT) {
              output = output.substring(0, MAX_TOOL_OUTPUT) +
                `\n\n[Output truncated - ${output.length} total characters]`;
            }

            eventBus.emit('agent:tool_result', {
              agent: this.name,
              tool: tc.name,
              result: output.substring(0, 500),
              isError: toolResult.isError,
            });
            this.emit('tool_result', { tool: tc.name, result: output, isError: toolResult.isError });

            messages.push({
              role: 'tool',
              content: output,
              toolCallId: tc.id,
              toolName: tc.name,
            });
          }

          // Detect read-only loops: if builder keeps reading without writing, nudge it
          const hasWriteCall = toolCalls.some(tc => writeToolNames.has(tc.name));
          if (hasWriteCall) {
            readOnlyIterations = 0;
          } else {
            readOnlyIterations++;
          }
          if (readOnlyIterations >= 8) {
            messages.push({
              role: 'user',
              content: 'IMPORTANT: You have spent 8 iterations reading files without creating or modifying any. You MUST now use file-write or file-edit to implement the required changes. Stop reading and start writing code.',
            });
            readOnlyIterations = 0;
          }

          continue;
        }

        // ── No tool calls: agent is finished ──

        // Self-reflection: ask the model to evaluate its own output
        if (this.enableReflection && contentText.length > 0) {
          try {
            const reflectionResult = await this.reflect(messages, contentText);
            if (reflectionResult) {
              // Reflection suggested improvements — re-inject as feedback and continue
              logger.info(this.name, `Reflection triggered improvement (score: ${reflectionResult.score})`);
              messages.push({ role: 'assistant', content: contentText });
              messages.push({
                role: 'user',
                content: `Self-review feedback (score: ${reflectionResult.score}/10):\n${reflectionResult.feedback}\n\nPlease address these issues and provide an improved response.`,
              });
              this.enableReflection = false; // only reflect once
              continue;
            }
          } catch (reflectErr) {
            logger.warn(this.name, `Reflection failed: ${(reflectErr as Error).message}`);
          }
        }

        const structured = this.parseOutput(contentText);

        logger.info(this.name, 'Agent completed', {
          iterations: iteration + 1,
          toolCalls: totalToolCalls,
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          durationMs: Date.now() - startTime,
        });

        const output: AgentOutput = {
          success: true,
          content: contentText,
          structured,
          toolCallsMade: totalToolCalls,
          tokensUsed: { input: totalInputTokens, output: totalOutputTokens },
        };

        eventBus.emit('agent:complete', { agent: this.name, output });
        this.emit('complete', output);
        return output;
      }

      // Exhausted max iterations
      const lastAssistantContent = messages
        .filter(m => m.role === 'assistant')
        .map(m => m.content)
        .pop() || '';

      logger.warn(this.name, `Max iterations (${this.maxIterations}) reached`);

      const output: AgentOutput = {
        success: false,
        content: `Agent reached maximum iterations (${this.maxIterations}). Last response:\n${lastAssistantContent}`,
        structured: this.parseOutput(lastAssistantContent),
        toolCallsMade: totalToolCalls,
        tokensUsed: { input: totalInputTokens, output: totalOutputTokens },
      };

      eventBus.emit('agent:complete', { agent: this.name, output });
      this.emit('complete', output);
      return output;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorStack = err instanceof Error ? err.stack : undefined;

      // Provide actionable error info
      let detail = errorMessage;
      if (errorMessage.includes('API key') || errorMessage.includes('api_key') || errorMessage.includes('Unauthorized') || errorMessage.includes('401')) {
        detail += '. Check your API key configuration with /doctor or set the key via environment variable.';
      } else if (errorMessage.includes('model') && (errorMessage.includes('not found') || errorMessage.includes('does not exist'))) {
        detail += '. The configured model may not exist or you may not have access. Use /model to change it.';
      } else if (errorMessage.includes('429') || errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
        detail += '. You have hit a rate limit. Wait a moment and try again, or switch to a different model.';
      }

      logger.error(this.name, `Agent run failed: ${errorMessage}`, {
        error: errorMessage,
        stack: errorStack,
        toolCallsMade: totalToolCalls,
        tokensUsed: { input: totalInputTokens, output: totalOutputTokens },
      });

      eventBus.emit('agent:error', { agent: this.name, error: detail });
      this.emit('error', { error: detail });

      return {
        success: false,
        content: `Agent error: ${detail}`,
        toolCallsMade: totalToolCalls,
        tokensUsed: { input: totalInputTokens, output: totalOutputTokens },
      };
    }
  }

  // ═══════════════════════════════════════════════
  // Provider Retry with Exponential Backoff
  // ═══════════════════════════════════════════════

  /**
   * Wrap provider.stream() with retry logic for transient errors
   * (network failures, rate limits, 5xx errors).
   */
  private async streamWithRetry(
    messages: Message[],
    tools?: ToolSchema[],
  ): Promise<AsyncGenerator<StreamChunk>> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= STREAM_RETRY_MAX; attempt++) {
      try {
        if (attempt > 0) {
          const backoff = STREAM_RETRY_BASE_MS * Math.pow(2, attempt - 1);
          logger.info(this.name, `Retrying stream (attempt ${attempt + 1}/${STREAM_RETRY_MAX + 1}) after ${backoff}ms`);
          await new Promise(r => setTimeout(r, backoff));
        }
        return this.provider.stream(messages, tools);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (!this.isRetryableError(lastError)) {
          throw lastError;
        }
        logger.warn(this.name, `Transient stream error (attempt ${attempt + 1}): ${lastError.message}`);
      }
    }

    throw lastError || new Error('Stream failed after retries');
  }

  /**
   * Determine if an error is transient and worth retrying.
   */
  private isRetryableError(err: Error): boolean {
    const msg = err.message.toLowerCase();
    return (
      msg.includes('429') ||
      msg.includes('rate limit') ||
      msg.includes('500') ||
      msg.includes('502') ||
      msg.includes('503') ||
      msg.includes('529') ||
      msg.includes('overloaded') ||
      msg.includes('timeout') ||
      msg.includes('econnreset') ||
      msg.includes('econnrefused') ||
      msg.includes('socket hang up') ||
      msg.includes('network') ||
      msg.includes('fetch failed')
    );
  }

  // ═══════════════════════════════════════════════
  // Parallel Tool Execution
  // ═══════════════════════════════════════════════

  /**
   * Execute multiple tool calls in parallel with individual timeouts.
   * Falls back to sequential if only one tool call.
   */
  private async executeToolsParallel(
    toolCalls: ToolCall[],
  ): Promise<Array<{ output: string; isError: boolean }>> {
    if (toolCalls.length === 1) {
      const tc = toolCalls[0];
      logger.info(this.name, `Tool call: ${tc.name}`, { args: tc.arguments });
      this.emit('tool_call', { tool: tc.name, args: tc.arguments });
      const result = await this.executeToolWithTimeout(tc.name, tc.arguments);
      return [result];
    }

    // Multiple tools → parallel execution
    logger.info(this.name, `Executing ${toolCalls.length} tool calls in parallel`);

    const promises = toolCalls.map(async (tc) => {
      logger.info(this.name, `Tool call: ${tc.name}`, { args: tc.arguments });
      this.emit('tool_call', { tool: tc.name, args: tc.arguments });
      return this.executeToolWithTimeout(tc.name, tc.arguments);
    });

    return Promise.all(promises);
  }

  /**
   * Execute a single tool call with a timeout wrapper.
   */
  private async executeToolWithTimeout(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<{ output: string; isError: boolean }> {
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        this.executeToolCall(toolName, args),
        new Promise<{ output: string; isError: boolean }>((_, reject) => {
          timeoutHandle = setTimeout(
            () => reject(new Error(`Tool '${toolName}' timed out after ${TOOL_TIMEOUT_MS}ms`)),
            TOOL_TIMEOUT_MS,
          );
        }),
      ]);
    } catch (err) {
      return {
        output: `Tool execution error: ${err instanceof Error ? err.message : String(err)}`,
        isError: true,
      };
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  }

  /**
   * Execute a single tool call via the tool executor.
   */
  private async executeToolCall(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<{ output: string; isError: boolean }> {
    try {
      const { executeTool } = await import('../tools/tool-executor.js');
      return await executeTool(toolName, args, this.name);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { output: `Tool execution error: ${msg}`, isError: true };
    }
  }

  // ═══════════════════════════════════════════════
  // Context Window Management
  // ═══════════════════════════════════════════════

  /**
   * Estimate total tokens in the conversation and compress if needed.
   * Compresses by summarizing old tool results and assistant messages,
   * keeping the system prompt and most recent messages intact.
   */
  private compressIfNeeded(messages: Message[]): void {
    const estimatedTokens = this.estimateTokens(messages);

    if (estimatedTokens < this.maxContextTokens) return;

    logger.info(this.name, `Context approaching limit (~${estimatedTokens} tokens). Compressing.`);

    // Strategy: Keep system prompt (index 0), user task (index 1),
    // and the last 6 messages. Summarize everything in between.
    const keepStart = 2; // system + user task
    const keepEnd = Math.min(4, messages.length - keepStart);

    if (messages.length <= keepStart + keepEnd) return;

    const toCompress = messages.slice(keepStart, messages.length - keepEnd);
    const kept = messages.slice(messages.length - keepEnd);

    // Build a compressed summary of the middle messages
    const summaryParts: string[] = ['[Compressed context from earlier in the conversation]'];
    let toolCallCount = 0;
    let toolNames = new Set<string>();
    const keyFindings: string[] = [];

    for (const msg of toCompress) {
      if (msg.role === 'assistant' && msg.toolCalls) {
        for (const tc of msg.toolCalls) {
          toolCallCount++;
          toolNames.add(tc.name);
        }
      }
      if (msg.role === 'assistant' && msg.content && !msg.toolCalls) {
        // Keep key decisions/findings from assistant
        const lines = msg.content.split('\n').filter(l => l.trim());
        if (lines.length > 0) {
          keyFindings.push(lines.slice(0, 3).join('\n'));
        }
      }
      if (msg.role === 'tool' && msg.content) {
        // Extract just the first line of tool results (usually the summary)
        const firstLine = msg.content.split('\n')[0];
        if (firstLine && firstLine.length < 200) {
          keyFindings.push(`Tool result: ${firstLine}`);
        }
      }
    }

    summaryParts.push(`Made ${toolCallCount} tool calls: ${Array.from(toolNames).join(', ')}`);
    if (keyFindings.length > 0) {
      summaryParts.push('Key findings:');
      // Keep only the most recent findings to avoid bloat
      summaryParts.push(...keyFindings.slice(-10));
    }

    const compressedMsg: Message = {
      role: 'user',
      content: summaryParts.join('\n'),
    };

    // Replace messages in-place
    messages.length = keepStart;
    messages.push(compressedMsg);
    messages.push(...kept);

    const newEstimate = this.estimateTokens(messages);
    logger.info(this.name, `Compressed: ${estimatedTokens} → ~${newEstimate} tokens (${messages.length} messages)`);
  }

  /**
   * Rough token estimation: chars / 4.
   */
  private estimateTokens(messages: Message[]): number {
    let chars = 0;
    for (const msg of messages) {
      chars += (msg.content || '').length;
      if (msg.toolCalls) {
        for (const tc of msg.toolCalls) {
          chars += tc.name.length;
          try {
            chars += JSON.stringify(tc.arguments).length;
          } catch {
            chars += 100; // fallback estimate for unserializable args
          }
        }
      }
    }
    return Math.ceil(chars / CHARS_PER_TOKEN);
  }

  // ═══════════════════════════════════════════════
  // Self-Reflection
  // ═══════════════════════════════════════════════

  /**
   * Ask the model to evaluate its own output.
   * Returns null if the output is acceptable (score >= 7),
   * or feedback/score if improvements are needed.
   */
  private async reflect(
    messages: Message[],
    output: string,
  ): Promise<{ score: number; feedback: string } | null> {
    const reflectionPrompt = [
      'Review your output above critically. Rate it 1-10 and identify any issues.',
      'Consider:',
      '- Is the output complete? Did you miss any part of the task?',
      '- Are there any bugs, syntax errors, or logical mistakes?',
      '- Does the code follow best practices for this project?',
      '',
      'Respond with ONLY a JSON object: { "score": <1-10>, "feedback": "<issues found>" }',
      'If score >= 7, set feedback to "Looks good".',
    ].join('\n');

    const reflectionMessages: Message[] = [
      ...messages.slice(0, 2), // system + user task
      { role: 'assistant', content: output },
      { role: 'user', content: reflectionPrompt },
    ];

    const response = await this.provider.complete(reflectionMessages);
    const json = this.extractJsonBlock(response.content);

    if (json && typeof json === 'object') {
      const obj = json as Record<string, unknown>;
      const score = Number(obj.score ?? 10);
      const feedback = String(obj.feedback ?? '');

      if (score < 7 && feedback && feedback !== 'Looks good') {
        return { score, feedback };
      }
    }

    return null;
  }

  // ═══════════════════════════════════════════════
  // Output Parsing
  // ═══════════════════════════════════════════════

  /**
   * Extract a JSON block from the agent's text output.
   */
  protected extractJsonBlock(content: string): unknown | null {
    // Try fenced ```json block first
    const fencedMatch = content.match(/```json\s*\n([\s\S]*?)\n\s*```/);
    if (fencedMatch) {
      try {
        return JSON.parse(fencedMatch[1]);
      } catch {
        // Fall through
      }
    }

    // Try to find a valid JSON object by bracket-matching from the first {
    const start = content.indexOf('{');
    if (start !== -1) {
      let depth = 0;
      let inString = false;
      let escape = false;
      for (let i = start; i < content.length; i++) {
        const ch = content[i];
        if (escape) { escape = false; continue; }
        if (ch === '\\' && inString) { escape = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) {
            try {
              return JSON.parse(content.slice(start, i + 1));
            } catch {
              break; // Malformed, give up
            }
          }
        }
      }
    }

    return null;
  }
}
