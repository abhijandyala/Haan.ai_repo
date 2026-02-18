import { WorkingMemory } from './working-memory.js';
import { LongTermMemory } from './long-term-memory.js';
import { MemoryEntry } from './types.js';

/**
 * Unified interface combining working memory (per-task) and long-term memory (persistent).
 */
export class MemoryManager {
  working: WorkingMemory;
  longTerm: LongTermMemory;

  constructor(_projectRoot: string) {
    this.working = new WorkingMemory();
    this.longTerm = new LongTermMemory();
  }

  // ---- Working memory convenience methods ----

  saveWorkingState(key: string, data: unknown): void {
    this.working.save(key, data);
  }

  getWorkingState<T = unknown>(key: string): T | undefined {
    return this.working.load<T>(key);
  }

  clearWorkingState(): void {
    this.working.clear();
  }

  // ---- Long-term memory convenience methods ----

  remember(key: string, content: string, tags: string[] = []): void {
    this.longTerm.save(key, content, tags);
  }

  recall(key: string): string | null {
    const entry = this.longTerm.load(key);
    return entry ? entry.content : null;
  }

  search(query: string): MemoryEntry[] {
    return this.longTerm.search(query);
  }
}
