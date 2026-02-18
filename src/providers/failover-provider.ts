import { IProvider, Message, ToolSchema, ProviderResponse, StreamChunk } from './types.js';
import { logger } from '../utils/logger.js';

interface CircuitState {
  failures: number;
  openUntil: number; // timestamp when circuit breaker re-closes
}

const CIRCUIT_THRESHOLD = 3;      // consecutive failures to open circuit
const CIRCUIT_RESET_MS = 60_000;  // 60s cooldown

/**
 * Wraps multiple providers with automatic failover and circuit breaker.
 *
 * - Tries primary first, then fallbacks in order
 * - On rate limit (429) or server error (5xx), tries the next provider
 * - On auth error (401/403), skips the provider permanently for this session
 * - Circuit breaker: after CIRCUIT_THRESHOLD consecutive failures, disables
 *   provider for CIRCUIT_RESET_MS
 */
export class FailoverProvider implements IProvider {
  name: string;
  model: string;
  private providers: IProvider[];
  private circuits: Map<string, CircuitState> = new Map();
  private disabled: Set<string> = new Set(); // permanently disabled (auth errors)

  constructor(providers: IProvider[]) {
    if (providers.length === 0) {
      throw new Error('FailoverProvider requires at least one provider');
    }
    this.providers = providers;
    this.name = providers[0].name;
    this.model = providers[0].model;

    for (const p of providers) {
      this.circuits.set(p.name, { failures: 0, openUntil: 0 });
    }
  }

  async complete(messages: Message[], tools?: ToolSchema[]): Promise<ProviderResponse> {
    const errors: string[] = [];

    for (const provider of this.getAvailableProviders()) {
      try {
        const result = await provider.complete(messages, tools);
        this.recordSuccess(provider.name);
        // Update outer model/name to reflect which provider succeeded
        this.name = provider.name;
        this.model = provider.model;
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        errors.push(`${provider.name}(${provider.model}): ${error.message}`);

        if (this.isAuthError(error)) {
          logger.warn('failover', `Auth error from ${provider.name} — disabling permanently`);
          this.disabled.add(provider.name);
          continue;
        }

        if (this.isRetryableError(error)) {
          logger.warn('failover', `Retryable error from ${provider.name} — trying next`);
          this.recordFailure(provider.name);
          continue;
        }

        // Non-retryable, non-auth error — propagate immediately
        throw error;
      }
    }

    throw new Error(`All providers failed:\n${errors.join('\n')}`);
  }

  async *stream(messages: Message[], tools?: ToolSchema[]): AsyncGenerator<StreamChunk> {
    const errors: string[] = [];

    for (const provider of this.getAvailableProviders()) {
      try {
        const gen = provider.stream(messages, tools);
        // Try to get the first chunk to verify the connection works
        const first = await gen.next();
        this.recordSuccess(provider.name);
        this.name = provider.name;
        this.model = provider.model;

        if (!first.done) {
          yield first.value;
        }
        yield* gen;
        return;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        errors.push(`${provider.name}(${provider.model}): ${error.message}`);

        if (this.isAuthError(error)) {
          logger.warn('failover', `Auth error from ${provider.name} — disabling permanently`);
          this.disabled.add(provider.name);
          continue;
        }

        if (this.isRetryableError(error)) {
          logger.warn('failover', `Retryable error from ${provider.name} — trying next`);
          this.recordFailure(provider.name);
          continue;
        }

        throw error;
      }
    }

    throw new Error(`All providers failed:\n${errors.join('\n')}`);
  }

  private getAvailableProviders(): IProvider[] {
    const now = Date.now();
    return this.providers.filter(p => {
      if (this.disabled.has(p.name)) return false;
      const circuit = this.circuits.get(p.name);
      if (circuit && circuit.openUntil > now) {
        logger.debug('failover', `Circuit open for ${p.name} — skipping (resets in ${circuit.openUntil - now}ms)`);
        return false;
      }
      return true;
    });
  }

  private recordSuccess(providerName: string): void {
    const circuit = this.circuits.get(providerName);
    if (circuit) {
      circuit.failures = 0;
      circuit.openUntil = 0;
    }
  }

  private recordFailure(providerName: string): void {
    const circuit = this.circuits.get(providerName);
    if (circuit) {
      circuit.failures++;
      if (circuit.failures >= CIRCUIT_THRESHOLD) {
        circuit.openUntil = Date.now() + CIRCUIT_RESET_MS;
        logger.warn('failover', `Circuit breaker opened for ${providerName} after ${circuit.failures} failures. Cooldown: ${CIRCUIT_RESET_MS}ms`);
      }
    }
  }

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
      msg.includes('fetch failed')
    );
  }

  private isAuthError(err: Error): boolean {
    const msg = err.message.toLowerCase();
    return (
      msg.includes('401') ||
      msg.includes('403') ||
      msg.includes('unauthorized') ||
      msg.includes('forbidden') ||
      msg.includes('invalid api key') ||
      msg.includes('api key')
    );
  }
}
