import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { haanSubDir } from '../utils/path-utils.js';
import { logger } from '../utils/logger.js';
import { MemoryEntry, MemoryIndex } from './types.js';

/**
 * Persistent memory stored in .haan/memory/.
 * Uses an index file for fast lookups and individual entry files for full content.
 */
export class LongTermMemory {
  private baseDir: string;
  private entriesDir: string;
  private indexPath: string;

  constructor() {
    this.baseDir = haanSubDir('memory');
    this.entriesDir = haanSubDir('memory/entries');
    this.indexPath = path.join(this.baseDir, 'index.json');
  }

  /** Create or update an entry by key. */
  save(key: string, content: string, tags: string[] = []): void {
    const index = this.loadIndex();
    const now = new Date().toISOString();

    // Check if entry already exists for this key
    const existing = index.entries.find(e => e.key === key);
    let id: string;

    if (existing) {
      id = existing.id;
      existing.tags = tags;
      existing.summary = content.slice(0, 200);
    } else {
      id = crypto.randomUUID();
      index.entries.push({
        id,
        key,
        tags,
        summary: content.slice(0, 200),
      });
    }

    // Write full entry
    const entry: MemoryEntry = {
      id,
      key,
      content,
      tags,
      createdAt: existing ? this.loadEntry(id)?.createdAt ?? now : now,
      updatedAt: now,
    };

    try {
      fs.writeFileSync(
        path.join(this.entriesDir, `${id}.json`),
        JSON.stringify(entry, null, 2),
        'utf-8',
      );
      this.saveIndex(index);
    } catch (err) {
      logger.error('LongTermMemory', `Failed to save key "${key}"`, err);
    }
  }

  /** Load a full entry by key. Returns null if not found. */
  load(key: string): MemoryEntry | null {
    const index = this.loadIndex();
    const meta = index.entries.find(e => e.key === key);
    if (!meta) return null;
    return this.loadEntry(meta.id);
  }

  /** Search entries by key substring match and tag match. */
  search(query: string): MemoryEntry[] {
    const index = this.loadIndex();
    const lower = query.toLowerCase();

    const matches = index.entries.filter(e => {
      const keyMatch = e.key.toLowerCase().includes(lower);
      const tagMatch = e.tags.some(t => t.toLowerCase().includes(lower));
      const summaryMatch = e.summary.toLowerCase().includes(lower);
      return keyMatch || tagMatch || summaryMatch;
    });

    const results: MemoryEntry[] = [];
    for (const meta of matches) {
      const entry = this.loadEntry(meta.id);
      if (entry) results.push(entry);
    }
    return results;
  }

  /** Return all entries from the index (metadata only for performance). */
  list(): MemoryIndex['entries'] {
    return this.loadIndex().entries;
  }

  /** Delete an entry by key. */
  delete(key: string): boolean {
    const index = this.loadIndex();
    const idx = index.entries.findIndex(e => e.key === key);
    if (idx === -1) return false;

    const meta = index.entries[idx];
    const entryPath = path.join(this.entriesDir, `${meta.id}.json`);

    // Remove entry file
    try {
      if (fs.existsSync(entryPath)) {
        fs.unlinkSync(entryPath);
      }
    } catch (err) {
      logger.error('LongTermMemory', `Failed to delete entry file for "${key}"`, err);
    }

    // Update index
    index.entries.splice(idx, 1);
    this.saveIndex(index);
    return true;
  }

  private loadEntry(id: string): MemoryEntry | null {
    const entryPath = path.join(this.entriesDir, `${id}.json`);
    if (!fs.existsSync(entryPath)) return null;
    try {
      const raw = fs.readFileSync(entryPath, 'utf-8');
      return JSON.parse(raw) as MemoryEntry;
    } catch (err) {
      logger.error('LongTermMemory', `Failed to load entry ${id}`, err);
      return null;
    }
  }

  private loadIndex(): MemoryIndex {
    if (!fs.existsSync(this.indexPath)) {
      return { entries: [], lastUpdated: new Date().toISOString() };
    }
    try {
      const raw = fs.readFileSync(this.indexPath, 'utf-8');
      return JSON.parse(raw) as MemoryIndex;
    } catch {
      return { entries: [], lastUpdated: new Date().toISOString() };
    }
  }

  private saveIndex(index: MemoryIndex): void {
    index.lastUpdated = new Date().toISOString();
    try {
      fs.writeFileSync(this.indexPath, JSON.stringify(index, null, 2), 'utf-8');
    } catch (err) {
      logger.error('LongTermMemory', 'Failed to save index', err);
    }
  }
}
