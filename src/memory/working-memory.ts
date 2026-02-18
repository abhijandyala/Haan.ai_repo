import fs from 'fs';
import path from 'path';
import { haanSubDir } from '../utils/path-utils.js';
import { logger } from '../utils/logger.js';

/**
 * Per-task shared state stored in .haan/working/.
 * Used by agents within a single pipeline run to share intermediate results.
 */
export class WorkingMemory {
  private dir: string;

  constructor() {
    this.dir = haanSubDir('working');
  }

  /** Save a JSON-serializable value under the given key. */
  save(key: string, data: unknown): void {
    const filePath = this.keyPath(key);
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      logger.error('WorkingMemory', `Failed to save key "${key}"`, err);
    }
  }

  /** Load a value by key. Returns undefined if not found. */
  load<T = unknown>(key: string): T | undefined {
    const filePath = this.keyPath(key);
    if (!fs.existsSync(filePath)) return undefined;
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw) as T;
    } catch (err) {
      logger.error('WorkingMemory', `Failed to load key "${key}"`, err);
      return undefined;
    }
  }

  /** Remove all files in the working directory. */
  clear(): void {
    try {
      const files = fs.readdirSync(this.dir);
      for (const file of files) {
        fs.unlinkSync(path.join(this.dir, file));
      }
    } catch (err) {
      logger.error('WorkingMemory', 'Failed to clear working memory', err);
    }
  }

  /** Return all working memory entries as a single object keyed by filename stem. */
  getAll(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    try {
      const files = fs.readdirSync(this.dir);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const key = file.replace(/\.json$/, '');
        const raw = fs.readFileSync(path.join(this.dir, file), 'utf-8');
        try {
          result[key] = JSON.parse(raw);
        } catch {
          result[key] = raw;
        }
      }
    } catch (err) {
      logger.error('WorkingMemory', 'Failed to read working memory', err);
    }
    return result;
  }

  private keyPath(key: string): string {
    // Sanitize key to prevent path traversal
    const safe = key.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.dir, `${safe}.json`);
  }
}
