import fs from 'fs';
import path from 'path';
import { BaseTool, ToolResult } from './types.js';
import { haanSubDir } from '../utils/path-utils.js';
import { logger } from '../utils/logger.js';

interface MemoryEntry {
  key: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

function getMemoryDir(): string {
  return haanSubDir('memory');
}

function getMemoryFilePath(key: string): string {
  // Sanitize key to safe filename
  const safe = key.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(getMemoryDir(), `${safe}.json`);
}

function loadEntry(filePath: string): MemoryEntry | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as MemoryEntry;
  } catch {
    return null;
  }
}

function loadAllEntries(): MemoryEntry[] {
  const dir = getMemoryDir();
  let files: string[];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }

  const entries: MemoryEntry[] = [];
  for (const file of files) {
    const entry = loadEntry(path.join(dir, file));
    if (entry) entries.push(entry);
  }
  return entries;
}

export class MemorySaveTool extends BaseTool {
  name = 'memory-save';
  description = 'Save information to long-term memory. Use this to remember important facts, decisions, context, or patterns.';
  parameters = {
    type: 'object' as const,
    properties: {
      key: { type: 'string', description: 'Unique key to identify this memory' },
      content: { type: 'string', description: 'Content to remember' },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tags for categorization and search',
      },
    },
    required: ['key', 'content'],
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const key = params.key as string;
      const content = params.content as string;
      const tags = (params.tags as string[]) || [];

      const filePath = getMemoryFilePath(key);
      const now = new Date().toISOString();

      const existing = loadEntry(filePath);
      const entry: MemoryEntry = {
        key,
        content,
        tags,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };

      fs.writeFileSync(filePath, JSON.stringify(entry, null, 2), 'utf-8');
      logger.info('memory-save', `Saved memory: ${key}`);

      const action = existing ? 'Updated' : 'Saved';
      return this.success(`${action} memory: "${key}" (${tags.length} tags)`, {
        key,
        tags,
        action: action.toLowerCase(),
      });
    } catch (err) {
      return this.error(`Failed to save memory: ${(err as Error).message}`);
    }
  }
}

export class MemoryLoadTool extends BaseTool {
  name = 'memory-load';
  description = 'Load a specific memory by key.';
  parameters = {
    type: 'object' as const,
    properties: {
      key: { type: 'string', description: 'Memory key to load' },
    },
    required: ['key'],
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const key = params.key as string;
      const filePath = getMemoryFilePath(key);

      const entry = loadEntry(filePath);
      if (!entry) {
        return this.error(`Memory not found: "${key}"`);
      }

      const output = [
        `Key: ${entry.key}`,
        `Tags: ${entry.tags.join(', ') || 'none'}`,
        `Created: ${entry.createdAt}`,
        `Updated: ${entry.updatedAt}`,
        '',
        entry.content,
      ].join('\n');

      return this.success(output, { key: entry.key, tags: entry.tags });
    } catch (err) {
      return this.error(`Failed to load memory: ${(err as Error).message}`);
    }
  }
}

export class MemorySearchTool extends BaseTool {
  name = 'memory-search';
  description = 'Search memories by keyword. Searches keys, content, and tags.';
  parameters = {
    type: 'object' as const,
    properties: {
      query: { type: 'string', description: 'Search query' },
    },
    required: ['query'],
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    try {
      const query = (params.query as string).toLowerCase();
      const entries = loadAllEntries();

      const matches = entries.filter((e) => {
        const searchable = [e.key, e.content, ...e.tags].join(' ').toLowerCase();
        return searchable.includes(query);
      });

      if (matches.length === 0) {
        return this.success(`No memories found matching: "${params.query}"`);
      }

      const output = matches
        .map((e) => {
          const preview = e.content.length > 100 ? e.content.slice(0, 100) + '...' : e.content;
          return `[${e.key}] (tags: ${e.tags.join(', ') || 'none'})\n  ${preview}`;
        })
        .join('\n\n');

      return this.success(output, { matchCount: matches.length });
    } catch (err) {
      return this.error(`Memory search failed: ${(err as Error).message}`);
    }
  }
}
