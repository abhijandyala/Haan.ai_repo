import { GoogleGenerativeAI, FunctionCallingMode, Content, Part, FunctionDeclaration, Tool as GeminiTool } from '@google/generative-ai';
import { IProvider, Message, ToolSchema, ProviderResponse, StreamChunk, ToolCall } from './types.js';
import { logger } from '../utils/logger.js';

let fcCounter = 0;

export class GoogleProvider implements IProvider {
  name = 'google';
  model: string;
  private genAI: GoogleGenerativeAI;

  constructor(apiKey: string, model: string = 'gemini-2.5-pro') {
    this.model = model;
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async complete(messages: Message[], tools?: ToolSchema[]): Promise<ProviderResponse> {
    const { systemInstruction, contents } = this.convertMessages(messages);
    const geminiTools = tools?.length ? this.convertTools(tools) : undefined;

    const genModel = this.genAI.getGenerativeModel({
      model: this.model,
      ...(systemInstruction ? { systemInstruction } : {}),
      ...(geminiTools ? { tools: geminiTools, toolConfig: { functionCallingConfig: { mode: FunctionCallingMode.AUTO } } } : {}),
    });

    try {
      const result = await genModel.generateContent({ contents });
      return this.parseResponse(result);
    } catch (err) {
      logger.error('google', 'API error', err);
      throw err;
    }
  }

  async *stream(messages: Message[], tools?: ToolSchema[]): AsyncGenerator<StreamChunk> {
    const { systemInstruction, contents } = this.convertMessages(messages);
    const geminiTools = tools?.length ? this.convertTools(tools) : undefined;

    const genModel = this.genAI.getGenerativeModel({
      model: this.model,
      ...(systemInstruction ? { systemInstruction } : {}),
      ...(geminiTools ? { tools: geminiTools, toolConfig: { functionCallingConfig: { mode: FunctionCallingMode.AUTO } } } : {}),
    });

    try {
      const result = await genModel.generateContentStream({ contents });
      let inputTokens = 0;
      let outputTokens = 0;

      for await (const chunk of result.stream) {
        // Extract parts for reasoning detection (Gemini 2.5+ thinking)
        const candidates = chunk.candidates;
        if (candidates) {
          for (const candidate of candidates) {
            for (const part of (candidate.content?.parts || []) as unknown as Array<Record<string, unknown>>) {
              // Gemini thinking/reasoning parts: { thought: true, text: "..." }
              if (part.thought === true && part.text) {
                yield { type: 'reasoning', text: String(part.text) };
              }
            }
          }
        }

        // text() throws on chunks with only function calls (Gemini 3+)
        let text = '';
        try { text = chunk.text(); } catch { /* no text in this chunk */ }
        if (text) {
          yield { type: 'text', text };
        }

        // Check for function calls — capture thoughtSignature at part level for Gemini 2.5+/3
        if (candidates) {
          for (const candidate of candidates) {
            for (const part of (candidate.content?.parts || []) as unknown as Array<Record<string, unknown>>) {
              if (part.functionCall) {
                const fc = part.functionCall as Record<string, unknown>;
                const tc: ToolCall = {
                  id: `fc_${Date.now()}_${++fcCounter}`,
                  name: fc.name as string,
                  arguments: (fc.args || {}) as Record<string, unknown>,
                };
                // thought_signature lives at PART level, not inside functionCall
                const sig = part.thoughtSignature || part.thought_signature ||
                            fc.thoughtSignature || fc.thought_signature;
                if (sig) tc.thoughtSignature = String(sig);
                yield { type: 'tool_call_start', toolCall: tc };
                yield { type: 'tool_call_end', toolCall: tc };
              }
            }
          }
        }

        if (chunk.usageMetadata) {
          inputTokens = chunk.usageMetadata.promptTokenCount || 0;
          outputTokens = chunk.usageMetadata.candidatesTokenCount || 0;
        }
      }

      yield { type: 'done', usage: { inputTokens, outputTokens } };
    } catch (err) {
      logger.error('google', 'Stream error', err);
      yield { type: 'error', error: String(err) };
    }
  }

  private convertMessages(messages: Message[]): { systemInstruction: string | undefined; contents: Content[] } {
    let systemInstruction: string | undefined;
    const contents: Content[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemInstruction = msg.content;
        continue;
      }

      if (msg.role === 'user') {
        contents.push({ role: 'user', parts: [{ text: msg.content }] });
      } else if (msg.role === 'assistant') {
        const parts: Part[] = [];
        if (msg.content) parts.push({ text: msg.content });
        if (msg.toolCalls) {
          for (const tc of msg.toolCalls) {
            const fcPart: Record<string, unknown> = {
              functionCall: {
                name: tc.name,
                args: tc.arguments,
              },
              // thought_signature must be at PART level, not inside functionCall
              ...(tc.thoughtSignature ? { thoughtSignature: tc.thoughtSignature } : {}),
            };
            parts.push(fcPart as unknown as Part);
          }
        }
        contents.push({ role: 'model', parts });
      } else if (msg.role === 'tool') {
        contents.push({
          role: 'function' as Content['role'],
          parts: [{
            functionResponse: {
              name: msg.toolName || msg.toolCallId || 'unknown',
              response: { result: msg.content },
            },
          }],
        });
      }
    }

    return { systemInstruction, contents };
  }

  private convertTools(tools: ToolSchema[]): GeminiTool[] {
    const declarations: FunctionDeclaration[] = tools.map(t => ({
      name: t.name,
      description: t.description,
      parameters: this.convertSchema(t.parameters) as unknown as FunctionDeclaration['parameters'],
    }));
    return [{ functionDeclarations: declarations }];
  }

  private convertSchema(schema: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    if (schema.type) result.type = String(schema.type).toUpperCase();
    if (schema.description) result.description = schema.description;
    if (schema.properties) {
      const props: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(schema.properties as Record<string, unknown>)) {
        props[key] = this.convertSchema(val as Record<string, unknown>);
      }
      result.properties = props;
    }
    if (schema.required) result.required = schema.required;
    if (schema.items) result.items = this.convertSchema(schema.items as Record<string, unknown>);
    if (schema.enum) result.enum = schema.enum;
    return result;
  }

  private parseResponse(result: unknown): ProviderResponse {
    const res = result as { response: { candidates?: Array<{ content?: { parts?: Array<Record<string, unknown>> } }>; text: () => string; functionCalls: () => Array<{ name: string; args: Record<string, unknown> }> | undefined; usageMetadata?: { promptTokenCount: number; candidatesTokenCount: number } } };
    const response = res.response;
    const toolCalls: ToolCall[] = [];

    // Extract function calls with thought signatures from raw candidates
    // thought_signature lives at PART level, not inside functionCall
    const candidates = response.candidates;
    if (candidates) {
      for (const candidate of candidates) {
        for (const part of (candidate.content?.parts || []) as Array<Record<string, unknown>>) {
          if (part.functionCall) {
            const fc = part.functionCall as Record<string, unknown>;
            const tc: ToolCall = {
              id: `fc_${Date.now()}_${++fcCounter}`,
              name: fc.name as string,
              arguments: (fc.args || {}) as Record<string, unknown>,
            };
            const sig = part.thoughtSignature || part.thought_signature ||
                        fc.thoughtSignature || fc.thought_signature;
            if (sig) tc.thoughtSignature = String(sig);
            toolCalls.push(tc);
          }
        }
      }
    }

    // Fallback: use SDK helper if no candidates-based extraction
    if (toolCalls.length === 0) {
      const functionCalls = response.functionCalls();
      if (functionCalls) {
        for (const fc of functionCalls) {
          toolCalls.push({
            id: `fc_${Date.now()}_${++fcCounter}`,
            name: fc.name,
            arguments: fc.args || {},
          });
        }
      }
    }

    let content = '';
    try { content = response.text() || ''; } catch { /* function-call-only response */ }

    return {
      content,
      toolCalls,
      usage: {
        inputTokens: response.usageMetadata?.promptTokenCount || 0,
        outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
      },
      stopReason: toolCalls.length ? 'tool_use' : 'end',
    };
  }
}
