import { logger } from '../utils/logger.js';

/**
 * Token bucket rate limiter.
 * Limits requests per provider to avoid hitting API rate limits.
 */
export class RateLimiter {
  private tokens: number;
  private maxTokens: number;
  private refillRate: number; // tokens per second
  private lastRefill: number;
  private queue: Array<{ resolve: () => void }> = [];
  private draining = false;

  /**
   * @param maxTokens Maximum burst size
   * @param refillRate Tokens added per second
   */
  constructor(maxTokens: number = 10, refillRate: number = 2) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillRate;
    this.lastRefill = Date.now();
  }

  /**
   * Acquire a token. Resolves immediately if a token is available,
   * otherwise waits until one becomes available.
   */
  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens--;
      return;
    }

    // Queue the request
    return new Promise<void>(resolve => {
      this.queue.push({ resolve });
      this.scheduleDrain();
    });
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }

  private scheduleDrain(): void {
    if (this.draining || this.queue.length === 0) return;
    this.draining = true;

    const waitMs = Math.ceil(1000 / this.refillRate);
    setTimeout(() => {
      this.draining = false;
      this.refill();

      while (this.queue.length > 0 && this.tokens >= 1) {
        this.tokens--;
        const next = this.queue.shift();
        next?.resolve();
      }

      if (this.queue.length > 0) {
        this.scheduleDrain();
      }
    }, waitMs);
  }

  /** Current available tokens (for debugging). */
  get available(): number {
    this.refill();
    return Math.floor(this.tokens);
  }
}

/**
 * Per-provider rate limiters.
 */
const limiters = new Map<string, RateLimiter>();

export function getRateLimiter(providerName: string): RateLimiter {
  let limiter = limiters.get(providerName);
  if (!limiter) {
    // Sensible defaults per provider
    const config: Record<string, [number, number]> = {
      openai: [10, 3],     // 10 burst, 3/sec
      anthropic: [8, 2],   // 8 burst, 2/sec
      google: [10, 3],     // 10 burst, 3/sec
    };
    const [max, rate] = config[providerName] || [10, 2];
    limiter = new RateLimiter(max, rate);
    limiters.set(providerName, limiter);
    logger.debug('rate-limiter', `Created rate limiter for ${providerName}: ${max} burst, ${rate}/sec`);
  }
  return limiter;
}
