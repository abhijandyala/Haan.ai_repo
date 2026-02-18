import { execSync } from 'child_process';
import { CommandHandler } from './index.js';
import { getProjectRoot } from '../../utils/path-utils.js';

export const undoCommand: CommandHandler = {
  name: 'undo',
  description: 'Undo last git commit (keeps changes staged) or restore stashed changes',
  usage: '/undo [stash]',
  async execute(args, context) {
    const root = getProjectRoot();
    const sub = args.trim().toLowerCase();

    try {
      execSync('git rev-parse --is-inside-work-tree', { cwd: root, stdio: 'pipe' });
    } catch {
      context.addMessage('system', 'Not a git repository. `/undo` requires git.');
      return;
    }

    if (sub === 'stash') {
      // Restore from stash
      try {
        const stashList = execSync('git stash list', { cwd: root, encoding: 'utf-8' }).trim();
        if (!stashList) {
          context.addMessage('system', 'No stashes found.');
          return;
        }
        execSync('git stash pop', { cwd: root, stdio: 'pipe' });
        context.addMessage('system', '\u2714 Restored changes from stash');
      } catch (err) {
        context.addMessage('system', `Failed to restore stash: ${(err as Error).message}`);
      }
      return;
    }

    // Default: undo last commit (soft reset)
    try {
      const lastCommit = execSync('git log --oneline -1', { cwd: root, encoding: 'utf-8' }).trim();
      if (!lastCommit) {
        context.addMessage('system', 'No commits to undo.');
        return;
      }
      execSync('git reset --soft HEAD~1', { cwd: root, stdio: 'pipe' });
      context.addMessage('system', `\u2714 Undid last commit: \`${lastCommit}\`\nChanges are staged and ready to re-commit.`);
    } catch (err) {
      context.addMessage('system', `Failed to undo: ${(err as Error).message}`);
    }
  },
};
