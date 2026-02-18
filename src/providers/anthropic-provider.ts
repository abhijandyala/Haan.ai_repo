import Anthropic from '@anthropic-ai/sdk';
import { IProvider, Message, ToolSchema, ProviderResponse, StreamChunk, ToolCall } from './types.js';
import { logger } from '../utils/logger.js';

export class AnthropicProvider implements IProvider {
  name = 'anthropic';
  model: string;
  private client: Anthropic;

  constructor(apiKey: string, model: string = 'claude-sonnet-4-5') {
    this.model = model;
    this.client = new Anthropic({ apiKey });
  }

  async complete(messages: Message[], tools?: ToolSchema[]): Promise<ProviderResponse> {
    const { system, msgs } = this.convertMessages(messages);

    const params: Anthropic.MessageCreateParams = {
      model: this.model,
      max_tokens: 16384,
      messages: msgs,
      ...(system ? { system } : {}),
      ...(tools?.length ? { tools: this.convertTools(tools) } : {}),
    };

    try {
      const response = await this.client.messages.create(params);
      return this.parseResponse(response);
    } catch (err) {
      logger.error('anthropic', 'API error', err);
      throw err;
    }
  }

  async *stream(messages: Message[], tools?: ToolSchema[]): AsyncGenerator<StreamChunk> {
    const { system, msgs } = this.convertMessages(messages);

    const params: Anthropic.MessageCreateParams = {
      model: this.model,
      max_tokens: 16384,
      messages: msgs,
      ...(system ? { system } : {}),
      ...(tools?.length ? { tools: this.convertTools(tools) } : {}),
      stream: true,
    };

    // Enable extended thinking for supported models
    const supportsThinking = /opus|sonnet/.test(this.model);
    if (supportsThinking) {
      (params as unknown as Record<string, unknown>).thinking = { type: 'enabled', budget_tokens: 8192 };
    }

    try {
      const stream = this.client.messages.stream(params);

      let currentToolCall: Partial<ToolCall> | null = null;
      let toolJsonBuffer = '';
      let isThinkingBlock = false;

      for await (const event of stream) {
        if (event.type === 'content_block_start') {
          const block = event.content_block;
          if (block.type === 'tool_use') {
            currentToolCall = { id: block.id, name: block.name, arguments: {} };
            toolJsonBuffer = '';
            yield { type: 'tool_call_start', toolCall: currentToolCall };
          } else if (block.type === 'thinking') {
            isThinkingBlock = true;
          }
        } else if (event.type === 'content_block_delta') {
          const delta = event.delta;
          if (delta.type === 'text_delta') {
            yield { type: 'text', text: delta.text };
          } else if (delta.type === 'thinking_delta' && isThinkingBlock) {
            const thinkingText = (delta as unknown as Record<string, unknown>).thinking;
            if (typeof thinkingText === 'string') {
              yield { type: 'reasoning', text: thinkingText };
            }
          } else if (delta.type === 'input_json_delta' && currentToolCall) {
            toolJsonBuffer += delta.partial_json;
            yield { type: 'tool_call_delta', toolCall: currentToolCall, text: delta.partial_json };
          }
        } else if (event.type === 'content_block_stop') {
          if (currentToolCall) {
            try {
              currentToolCall.arguments = JSON.parse(toolJsonBuffer || '{}');
            } catch {
              currentToolCall.arguments = {};
            }
            yield { type: 'tool_call_end', toolCall: currentToolCall };
            currentToolCall = null;
            toolJsonBuffer = '';
          }
          isThinkingBlock = false;
        } else if (event.type === 'message_delta') {
          const usage = (event as unknown as { usage?: { input_tokens?: number; output_tokens?: number } }).usage;
          if (usage) {
            yield { type: 'done', usage: { inputTokens: usage.input_tokens || 0, outputTokens: usage.output_tokens || 0 } };
          }
        }
      }

      const finalMessage = await stream.finalMessage();
      yield {
        type: 'done',
        usage: {
          inputTokens: finalMessage.usage.input_tokens,
          outputTokens: finalMessage.usage.output_tokens,
        },
      };
    } catch (err) {
      logger.error('anthropic', 'Stream error', err);
      yield { type: 'error', error: String(err) };
    }
  }

  private convertMessages(messages: Message[]): { system: string | undefined; msgs: Anthropic.MessageParam[] } {
    let system: string | undefined;
    const msgs: Anthropic.MessageParam[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        system = msg.content;
        continue;
      }
      if (msg.role === 'tool') {
        msgs.push({
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: msg.toolCallId || '',
            content: msg.content,
          }],
        });
        continue;
      }
      if (msg.role === 'assistant' && msg.toolCalls?.length) {
        const content: Anthropic.ContentBlockParam[] = [];
        if (msg.content) content.push({ type: 'text', text: msg.content });
        for (const tc of msg.toolCalls) {
          content.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.arguments });
        }
        msgs.push({ role: 'assistant', content });
        continue;
      }
      msgs.push({ role: msg.role as 'user' | 'assistant', content: msg.content });
    }

    return { system, msgs };
  }

  private convertTools(tools: ToolSchema[]): Anthropic.Tool[] {
    return tools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters as Anthropic.Tool.InputSchema,
    }));
  }

  private parseResponse(response: Anthropic.Message): ProviderResponse {
    let content = '';
    const toolCalls: ToolCall[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        content += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: block.input as Record<string, unknown>,
        });
      }
    }

    return {
      content,
      toolCalls,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      stopReason: response.stop_reason === 'tool_use' ? 'tool_use' : 'end',
    };
  }
}
