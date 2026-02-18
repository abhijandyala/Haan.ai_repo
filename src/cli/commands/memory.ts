import { CommandHandler } from './index.js';
import { MemoryManager } from '../../memory/memory-manager.js';
import { getProjectRoot } from '../../utils/path-utils.js';

export const memoryCommand: CommandHandler = {
  name: 'memory',
  description: 'View or search long-term memory',
  usage: '/memory [search query]',
  async execute(args, context) {
    const mm = new MemoryManager(getProjectRoot());

    if (!args) {
      const entries = mm.longTerm.list();
      if (entries.length === 0) {
        context.addMessage('system', 'No memories stored yet. Memories are saved automatically during agent operations.');
        return;
      }
      const lines = ['═══ LONG-TERM MEMORY ═══', ''];
      for (const entry of entries) {
        lines.push(`• ${entry.key} [${entry.tags.join(', ')}]`);
        lines.push(`  ${entry.summary}`);
      }
      context.addMessage('system', lines.join('\n'));
      return;
    }

    const results = mm.search(args);
    if (results.length === 0) {
      context.addMessage('system', `No memories found matching "${args}"`);
      return;
    }
    const lines = [`Found ${results.length} memories matching "${args}":`, ''];
    for (const entry of results) {
      lines.push(`• ${entry.key}`);
      lines.push(`  ${entry.content.slice(0, 200)}${entry.content.length > 200 ? '...' : ''}`);
    }
    context.addMessage('system', lines.join('\n'));
  },
};
