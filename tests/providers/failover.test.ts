import { describe, it, expect, vi } from 'vitest';
import { FailoverProvider } from '../../src/providers/failover-provider.js';
import { IProvider, Message, ProviderResponse, StreamChunk } from '../../src/providers/types.js';

function createMockProvider(
  name: string,
  model: string,
  behavior: {
    complete?: () => Promise<ProviderResponse>;
    stream?: () => AsyncGenerator<StreamChunk>;
  } = {},
): IProvider {
  const defaultResponse: ProviderResponse = {
    content: `Response from ${name}`,
    toolCalls: [],
    usage: { inputTokens: 10, outputTokens: 20 },
    stopReason: 'end',
  };

  return {
    name,
    model,
    complete: behavior.complete || vi.fn().mockResolvedValue(defaultResponse),
    stream: behavior.stream || vi.fn().mockReturnValue(
      (async function* () {
        yield { type: 'text' as const, text: `Text from ${name}` };
        yield { type: 'done' as const, usage: { inputTokens: 10, outputTokens: 20 } };
      })(),
    ),
  };
}

describe('FailoverProvider', () => {
  it('uses primary provider when available', async () => {
    const primary = createMockProvider('openai', 'gpt-5.2-codex');
    const fallback = createMockProvider('anthropic', 'claude-sonnet-4-5');

    const failover = new FailoverProvider([primary, fallback]);
    const messages: Message[] = [{ role: 'user', content: 'hello' }];

    const result = await failover.complete(messages);
    expect(result.content).toBe('Response from openai');
    expect(primary.complete).toHaveBeenCalled();
    expect(fallback.complete).not.toHaveBeenCalled();
  });

  it('falls back on rate limit error', async () => {
    const primary = createMockProvider('openai', 'gpt-5.2-codex', {
      complete: vi.fn().mockRejectedValue(new Error('429 rate limit exceeded')),
    });
    const fallback = createMockProvider('anthropic', 'claude-sonnet-4-5');

    const failover = new FailoverProvider([primary, fallback]);
    const messages: Message[] = [{ role: 'user', content: 'hello' }];

    const result = await failover.complete(messages);
    expect(result.content).toBe('Response from anthropic');
  });

  it('falls back on server error', async () => {
    const primary = createMockProvider('openai', 'gpt-5.2-codex', {
      complete: vi.fn().mockRejectedValue(new Error('503 Service Unavailable')),
    });
    const fallback = createMockProvider('google', 'gemini-2.5-pro');

    const failover = new FailoverProvider([primary, fallback]);
    const messages: Message[] = [{ role: 'user', content: 'hello' }];

    const result = await failover.complete(messages);
    expect(result.content).toBe('Response from google');
  });

  it('permanently disables provider on auth error', async () => {
    const primary = createMockProvider('openai', 'gpt-5.2-codex', {
      complete: vi.fn().mockRejectedValue(new Error('401 Unauthorized')),
    });
    const fallback = createMockProvider('anthropic', 'claude-sonnet-4-5');

    const failover = new FailoverProvider([primary, fallback]);
    const messages: Message[] = [{ role: 'user', content: 'hello' }];

    // First call falls back
    const result1 = await failover.complete(messages);
    expect(result1.content).toBe('Response from anthropic');

    // Second call should skip primary entirely
    const result2 = await failover.complete(messages);
    expect(result2.content).toBe('Response from anthropic');
    // Primary was called only once (then disabled)
    expect(primary.complete).toHaveBeenCalledTimes(1);
  });

  it('throws when all providers fail', async () => {
    const primary = createMockProvider('openai', 'gpt-5.2-codex', {
      complete: vi.fn().mockRejectedValue(new Error('429 rate limit')),
    });
    const fallback = createMockProvider('anthropic', 'claude-sonnet-4-5', {
      complete: vi.fn().mockRejectedValue(new Error('500 internal server error')),
    });

    const failover = new FailoverProvider([primary, fallback]);
    const messages: Message[] = [{ role: 'user', content: 'hello' }];

    await expect(failover.complete(messages)).rejects.toThrow(/All providers failed/);
  });

  it('propagates non-retryable errors immediately', async () => {
    const primary = createMockProvider('openai', 'gpt-5.2-codex', {
      complete: vi.fn().mockRejectedValue(new Error('Invalid request: malformed JSON')),
    });
    const fallback = createMockProvider('anthropic', 'claude-sonnet-4-5');

    const failover = new FailoverProvider([primary, fallback]);
    const messages: Message[] = [{ role: 'user', content: 'hello' }];

    await expect(failover.complete(messages)).rejects.toThrow('Invalid request: malformed JSON');
    expect(fallback.complete).not.toHaveBeenCalled();
  });

  it('requires at least one provider', () => {
    expect(() => new FailoverProvider([])).toThrow(/at least one provider/);
  });

  it('falls back during streaming', async () => {
    const primary = createMockProvider('openai', 'gpt-5.2-codex', {
      stream: vi.fn().mockReturnValue(
        (async function* () {
          throw new Error('502 Bad Gateway');
        })(),
      ),
    });
    const fallback = createMockProvider('anthropic', 'claude-sonnet-4-5');

    const failover = new FailoverProvider([primary, fallback]);
    const messages: Message[] = [{ role: 'user', content: 'hello' }];

    const chunks: StreamChunk[] = [];
    for await (const chunk of failover.stream(messages)) {
      chunks.push(chunk);
    }

    expect(chunks[0].type).toBe('text');
    expect(chunks[0].text).toBe('Text from anthropic');
  });
});
