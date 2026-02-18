export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  /** The tool/function name for tool result messages (needed by Gemini's functionResponse) */
  toolName?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  /** Gemini 3 thought signature — must be echoed back in multi-turn function calling */
  thoughtSignature?: string;
}

export interface ToolSchema {
  name: string;
  description: string;
  parameters: JsonSchema;
}

export interface JsonSchema {
  type: string;
  properties?: Record<string, unknown>;
  required?: string[];
  description?: string;
  [key: string]: unknown;
}

export interface StreamChunk {
  type: 'text' | 'reasoning' | 'tool_call_start' | 'tool_call_delta' | 'tool_call_end' | 'done' | 'error';
  text?: string;
  toolCall?: Partial<ToolCall>;
  error?: string;
  usage?: { inputTokens: number; outputTokens: number };
}

export interface ProviderResponse {
  content: string;
  toolCalls: ToolCall[];
  usage: { inputTokens: number; outputTokens: number };
  stopReason: 'end' | 'tool_use' | 'max_tokens' | 'error';
}

export interface IProvider {
  name: string;
  model: string;
  complete(messages: Message[], tools?: ToolSchema[]): Promise<ProviderResponse>;
  stream(messages: Message[], tools?: ToolSchema[]): AsyncGenerator<StreamChunk>;
}
