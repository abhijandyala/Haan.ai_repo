import OpenAI from 'openai';
import { IProvider, Message, ToolSchema, ProviderResponse, StreamChunk, ToolCall } from './types.js';
import { logger } from '../utils/logger.js';

// Models that ONLY work with the Responses API (not chat completions)
const RESPONSES_API_MODELS = /codex/i;

// Models that need max_completion_tokens instead of max_tokens in chat completions
const NEW_PARAM_MODELS = /^(gpt-5|o[1-9]|o\d+-)/;

export class OpenAIProvider implements IProvider {
  name = 'openai';
  model: string;
  private client: OpenAI;
  private useResponsesApi: boolean;

  constructor(apiKey: string, model: string = 'gpt-5.2-codex') {
    this.model = model;
    this.client = new OpenAI({ apiKey });
    this.useResponsesApi = RESPONSES_API_MODELS.test(model);
  }

  async complete(messages: Message[], tools?: ToolSchema[]): Promise<ProviderResponse> {
    if (this.useResponsesApi) {
      return this.completeResponses(messages, tools);
    }
    return this.completeChat(messages, tools);
  }

  async *stream(messages: Message[], tools?: ToolSchema[]): AsyncGenerator<StreamChunk> {
    if (this.useResponsesApi) {
      yield* this.streamResponses(messages, tools);
    } else {
      yield* this.streamChat(messages, tools);
    }
  }

  // ═══════════════════════════════════════════════
  // Responses API (for codex models)
  // ═══════════════════════════════════════════════

  private async completeResponses(messages: Message[], tools?: ToolSchema[]): Promise<ProviderResponse> {
    const { instructions, input } = this.convertToResponsesInput(messages);

    const params: Record<string, unknown> = {
      model: this.model,
      input,
      max_output_tokens: 16384,
      ...(instructions ? { instructions } : {}),
      ...(tools?.length ? { tools: this.convertToolsForResponses(tools) } : {}),
    };

    try {
      const response = await (this.client.responses as any).create(params);
      return this.parseResponsesOutput(response);
    } catch (err) {
      logger.error('openai-responses', 'API error', err);
      throw err;
    }
  }

  private async *streamResponses(messages: Message[], tools?: ToolSchema[]): AsyncGenerator<StreamChunk> {
    const { instructions, input } = this.convertToResponsesInput(messages);

    const params: Record<string, unknown> = {
      model: this.model,
      input,
      max_output_tokens: 16384,
      stream: true,
      ...(instructions ? { instructions } : {}),
      ...(tools?.length ? { tools: this.convertToolsForResponses(tools) } : {}),
    };

    try {
      const stream = await (this.client.responses as any).create(params);

      let currentFnCallId = '';
      let currentFnName = '';
      let currentFnArgs = '';

      for await (const event of stream) {
        const type = event.type;

        if (type === 'response.reasoning.delta' || type === 'response.reasoning_summary_text.delta') {
          // o-series reasoning / codex reasoning summaries
          yield { type: 'reasoning', text: event.delta || '' };
        } else if (type === 'response.output_text.delta') {
          yield { type: 'text', text: event.delta || '' };
        } else if (type === 'response.function_call_arguments.delta') {
          currentFnArgs += event.delta || '';
          yield { type: 'tool_call_delta', text: event.delta || '' };
        } else if (type === 'response.output_item.added') {
          const item = event.item;
          if (item?.type === 'function_call') {
            currentFnCallId = item.call_id || item.id || `fc_${Date.now()}`;
            currentFnName = item.name || '';
            currentFnArgs = '';
            yield {
              type: 'tool_call_start',
              toolCall: { id: currentFnCallId, name: currentFnName },
            };
          }
        } else if (type === 'response.output_item.done') {
          const item = event.item;
          if (item?.type === 'function_call') {
            let args: Record<string, unknown> = {};
            try { args = JSON.parse(currentFnArgs || item.arguments || '{}'); } catch { /* empty */ }
            yield {
              type: 'tool_call_end',
              toolCall: { id: currentFnCallId, name: currentFnName || item.name, arguments: args },
            };
            currentFnCallId = '';
            currentFnName = '';
            currentFnArgs = '';
          }
        } else if (type === 'response.completed') {
          const usage = event.response?.usage;
          yield {
            type: 'done',
            usage: {
              inputTokens: usage?.input_tokens || 0,
              outputTokens: usage?.output_tokens || 0,
            },
          };
        }
      }
    } catch (err) {
      logger.error('openai-responses', 'Stream error', err);
      yield { type: 'error', error: String(err) };
    }
  }

  private convertToResponsesInput(messages: Message[]): { instructions: string | undefined; input: unknown[] } {
    let instructions: string | undefined;
    const input: unknown[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        instructions = msg.content;
      } else if (msg.role === 'user') {
        input.push({ role: 'user', content: msg.content });
      } else if (msg.role === 'assistant') {
        if (msg.toolCalls?.length) {
          // Emit text first if any
          if (msg.content) {
            input.push({ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: msg.content }] });
          }
          // Then emit function calls
          for (const tc of msg.toolCalls) {
            input.push({
              type: 'function_call',
              id: tc.id.startsWith('fc_') ? tc.id : `fc_${tc.id}`,
              call_id: tc.id,
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            });
          }
        } else {
          input.push({ role: 'assistant', content: msg.content });
        }
      } else if (msg.role === 'tool') {
        input.push({
          type: 'function_call_output',
          call_id: msg.toolCallId || '',
          output: msg.content,
        });
      }
    }

    return { instructions, input };
  }

  private convertToolsForResponses(tools: ToolSchema[]): unknown[] {
    return tools.map(t => ({
      type: 'function',
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));
  }

  private parseResponsesOutput(response: any): ProviderResponse {
    let content = '';
    const toolCalls: ToolCall[] = [];

    for (const item of response.output || []) {
      if (item.type === 'message') {
        for (const c of item.content || []) {
          if (c.type === 'output_text') content += c.text;
        }
      } else if (item.type === 'function_call') {
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(item.arguments || '{}'); } catch { /* empty */ }
        toolCalls.push({
          id: item.call_id || item.id || `fc_${Date.now()}`,
          name: item.name,
          arguments: args,
        });
      }
    }

    return {
      content,
      toolCalls,
      usage: {
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 0,
      },
      stopReason: toolCalls.length ? 'tool_use' : 'end',
    };
  }

  // ═══════════════════════════════════════════════
  // Chat Completions API (for gpt-4.1, gpt-5, o-series, etc.)
  // ═══════════════════════════════════════════════

  private tokenParam(): Record<string, number> {
    return NEW_PARAM_MODELS.test(this.model)
      ? { max_completion_tokens: 16384 }
      : { max_tokens: 16384 };
  }

  private async completeChat(messages: Message[], tools?: ToolSchema[]): Promise<ProviderResponse> {
    const params: Record<string, unknown> = {
      model: this.model,
      messages: this.convertMessages(messages),
      ...this.tokenParam(),
      ...(tools?.length ? { tools: this.convertTools(tools) } : {}),
    };

    try {
      const response = await this.client.chat.completions.create(params as unknown as OpenAI.ChatCompletionCreateParams);
      return this.parseResponse(response as OpenAI.ChatCompletion);
    } catch (err) {
      logger.error('openai', 'API error', err);
      throw err;
    }
  }

  private async *streamChat(messages: Message[], tools?: ToolSchema[]): AsyncGenerator<StreamChunk> {
    const params: Record<string, unknown> = {
      model: this.model,
      messages: this.convertMessages(messages),
      ...this.tokenParam(),
      stream: true,
      stream_options: { include_usage: true },
      ...(tools?.length ? { tools: this.convertTools(tools) } : {}),
    };

    try {
      const stream = await this.client.chat.completions.create(params as unknown as OpenAI.ChatCompletionCreateParams);
      const toolCallBuffers = new Map<number, { id: string; name: string; argsJson: string }>();

      for await (const chunk of stream as AsyncIterable<OpenAI.ChatCompletionChunk>) {
        const choice = chunk.choices?.[0];
        const delta = choice?.delta;

        if (delta?.content) {
          yield { type: 'text', text: delta.content };
        }

        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index;
            if (!toolCallBuffers.has(idx)) {
              toolCallBuffers.set(idx, { id: tc.id || '', name: tc.function?.name || '', argsJson: '' });
              yield { type: 'tool_call_start', toolCall: { id: tc.id || '', name: tc.function?.name || '' } };
            }
            const buf = toolCallBuffers.get(idx)!;
            if (tc.id) buf.id = tc.id;
            if (tc.function?.name) buf.name = tc.function.name;
            if (tc.function?.arguments) {
              buf.argsJson += tc.function.arguments;
              yield { type: 'tool_call_delta', text: tc.function.arguments };
            }
          }
        }

        if (choice?.finish_reason) {
          for (const [idx, buf] of toolCallBuffers) {
            let args: Record<string, unknown> = {};
            try { args = JSON.parse(buf.argsJson || '{}'); } catch { /* empty */ }
            yield { type: 'tool_call_end', toolCall: { id: buf.id, name: buf.name, arguments: args } };
          }
          toolCallBuffers.clear();
        }

        if (chunk.usage) {
          yield {
            type: 'done',
            usage: { inputTokens: chunk.usage.prompt_tokens || 0, outputTokens: chunk.usage.completion_tokens || 0 },
          };
        }
      }
    } catch (err) {
      logger.error('openai', 'Stream error', err);
      yield { type: 'error', error: String(err) };
    }
  }

  private convertMessages(messages: Message[]): OpenAI.ChatCompletionMessageParam[] {
    const result: OpenAI.ChatCompletionMessageParam[] = [];
    for (const msg of messages) {
      if (msg.role === 'system') {
        result.push({ role: 'system', content: msg.content });
      } else if (msg.role === 'user') {
        result.push({ role: 'user', content: msg.content });
      } else if (msg.role === 'tool') {
        result.push({ role: 'tool', tool_call_id: msg.toolCallId || '', content: msg.content });
      } else if (msg.role === 'assistant') {
        if (msg.toolCalls?.length) {
          result.push({
            role: 'assistant',
            content: msg.content || null,
            tool_calls: msg.toolCalls.map(tc => ({
              id: tc.id, type: 'function' as const,
              function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
            })),
          });
        } else {
          result.push({ role: 'assistant', content: msg.content });
        }
      }
    }
    return result;
  }

  private convertTools(tools: ToolSchema[]): OpenAI.ChatCompletionTool[] {
    return tools.map(t => ({
      type: 'function' as const,
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
  }

  private parseResponse(response: OpenAI.ChatCompletion): ProviderResponse {
    const choice = response.choices[0];
    const toolCalls: ToolCall[] = [];
    if (choice.message.tool_calls) {
      for (const tc of choice.message.tool_calls) {
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(tc.function.arguments || '{}'); } catch { /* empty */ }
        toolCalls.push({ id: tc.id, name: tc.function.name, arguments: args });
      }
    }
    return {
      content: choice.message.content || '',
      toolCalls,
      usage: { inputTokens: response.usage?.prompt_tokens || 0, outputTokens: response.usage?.completion_tokens || 0 },
      stopReason: toolCalls.length ? 'tool_use' : 'end',
    };
  }
}
