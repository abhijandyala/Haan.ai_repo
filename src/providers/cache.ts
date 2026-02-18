import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { IProvider, ProviderResponse, StreamChunk, Message, ToolSchema } from './types.js';
import { getProjectRoot } from '../utils/path-utils.js';
import { logger } from '../utils/logger.js';

interface CacheEntry {
  hash: string;
  response: ProviderResponse;
  model: string;
  createdAt: number;
  sizeBytes: number;
}

interface CacheConfig {
  enabled: boolean;
  ttlMinutes: number;
  maxSizeMB: number;
}

const DEFAULT_CACHE_CONFIG: CacheConfig = {
  enabled: true,
  ttlMinutes: 60,
  maxSizeMB: 100,
};

/**
 * Generate a content-addressable hash for a prompt + model + tools combination.
 */
function hashRequest(model: string, messages: Message[], tools?: ToolSchema[]): string {
  const payload = JSON.stringify({ model, messages, tools: tools || [] });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * CachingProvider wraps another provider and caches complete() responses.
 * Streaming (stream()) is not cached — it always passes through.
 */
export class CachingProvider implements IProvider {
  name: string;
  model: string;
  private cacheDir: string;
  private config: CacheConfig;
  private inner: IProvider;

  constructor(inner: IProvider, config?: Partial<CacheConfig>) {
    this.inner = inner;
    this.name = inner.name;
    this.model = inner.model;
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    this.cacheDir = path.join(getProjectRoot(), '.haan', 'cache');
    this.ensureCacheDir();
  }

  async complete(messages: Message[], tools?: ToolSchema[]): Promise<ProviderResponse> {
    if (!this.config.enabled) {
      return this.inner.complete(messages, tools);
    }

    const hash = hashRequest(this.model, messages, tools);
    const cached = this.readCache(hash);

    if (cached) {
      logger.debug('cache', `Cache hit: ${hash.slice(0, 12)}... (${this.model})`);
      return cached;
    }

    const response = await this.inner.complete(messages, tools);

    // Only cache successful responses (no tool calls — those are context-dependent)
    if (!response.toolCalls || response.toolCalls.length === 0) {
      this.writeCache(hash, response);
    }

    return response;
  }

  async *stream(messages: Message[], tools?: ToolSchema[]): AsyncGenerator<StreamChunk> {
    // Streaming is not cached — pass through directly
    yield* this.inner.stream(messages, tools);
  }

  /**
   * Evict expired entries and enforce size limit.
   */
  evict(): { removed: number; freedBytes: number } {
    this.ensureCacheDir();
    const entries = this.listEntries();
    const now = Date.now();
    const ttlMs = this.config.ttlMinutes * 60_000;
    let removed = 0;
    let freedBytes = 0;

    // Remove expired entries
    for (const entry of entries) {
      if (now - entry.createdAt > ttlMs) {
        this.removeEntry(entry.hash);
        removed++;
        freedBytes += entry.sizeBytes;
      }
    }

    // Enforce size limit
    const remaining = this.listEntries();
    let totalSize = remaining.reduce((acc, e) => acc + e.sizeBytes, 0);
    const maxBytes = this.config.maxSizeMB * 1024 * 1024;

    // Remove oldest entries if over limit
    const sorted = remaining.sort((a, b) => a.createdAt - b.createdAt);
    for (const entry of sorted) {
      if (totalSize <= maxBytes) break;
      this.removeEntry(entry.hash);
      totalSize -= entry.sizeBytes;
      removed++;
      freedBytes += entry.sizeBytes;
    }

    if (removed > 0) {
      logger.info('cache', `Evicted ${removed} entries, freed ${(freedBytes / 1024).toFixed(1)} KB`);
    }

    return { removed, freedBytes };
  }

  private ensureCacheDir(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  private getCachePath(hash: string): string {
    return path.join(this.cacheDir, `${hash}.json`);
  }

  private readCache(hash: string): ProviderResponse | null {
    const filePath = this.getCachePath(hash);
    if (!fs.existsSync(filePath)) return null;

    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const entry: CacheEntry = JSON.parse(raw);

      // Check TTL
      const ttlMs = this.config.ttlMinutes * 60_000;
      if (Date.now() - entry.createdAt > ttlMs) {
        fs.unlinkSync(filePath);
        return null;
      }

      return entry.response;
    } catch {
      return null;
    }
  }

  private writeCache(hash: string, response: ProviderResponse): void {
    try {
      const data = JSON.stringify(response);
      const entry: CacheEntry = {
        hash,
        response,
        model: this.model,
        createdAt: Date.now(),
        sizeBytes: Buffer.byteLength(data, 'utf-8'),
      };
      fs.writeFileSync(this.getCachePath(hash), JSON.stringify(entry), 'utf-8');
      logger.debug('cache', `Cached response: ${hash.slice(0, 12)}... (${entry.sizeBytes} bytes)`);

      // Periodic eviction (every 20 writes)
      if (Math.random() < 0.05) {
        this.evict();
      }
    } catch (err) {
      logger.warn('cache', `Failed to write cache: ${(err as Error).message}`);
    }
  }

  private listEntries(): CacheEntry[] {
    try {
      const files = fs.readdirSync(this.cacheDir).filter(f => f.endsWith('.json'));
      return files.map(f => {
        try {
          const raw = fs.readFileSync(path.join(this.cacheDir, f), 'utf-8');
          return JSON.parse(raw) as CacheEntry;
        } catch {
          return null;
        }
      }).filter((e): e is CacheEntry => e !== null);
    } catch {
      return [];
    }
  }

  private removeEntry(hash: string): void {
    try {
      const filePath = this.getCachePath(hash);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // ignore
    }
  }
}
