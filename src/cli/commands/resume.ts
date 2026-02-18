import { CommandHandler } from './index.js';
import { listCheckpoints } from '../../pipeline/checkpoint.js';

export const resumeCommand: CommandHandler = {
  name: 'resume',
  description: 'Resume a pipeline from a checkpoint',
  usage: '/resume [task-text]',
  async execute(args, context) {
    const checkpoints = listCheckpoints();

    if (checkpoints.length === 0) {
      context.addMessage('system', 'No checkpoints found. Run a pipeline first.');
      return;
    }

    // If args provided, find matching checkpoint
    if (args.trim()) {
      const match = checkpoints.find(cp =>
        cp.task.toLowerCase().includes(args.trim().toLowerCase()),
      );
      if (match) {
        const completed = match.completedStages.join(', ');
        context.addMessage('system', `Resuming pipeline: "${match.task}"\nCompleted stages: ${completed}`);
        await context.runPipeline(match.task, undefined);
        return;
      }
      context.addMessage('system', `No checkpoint found matching: "${args.trim()}"`);
      return;
    }

    // Show available checkpoints
    const lines: string[] = ['Available checkpoints:', ''];
    for (let i = 0; i < Math.min(checkpoints.length, 10); i++) {
      const cp = checkpoints[i];
      const age = Math.round((Date.now() - cp.timestamp) / 60000);
      const completed = cp.completedStages.join(' -> ');
      lines.push(`  ${i + 1}. "${cp.task.slice(0, 60)}${cp.task.length > 60 ? '...' : ''}"`);
      lines.push(`     Completed: ${completed} | ${age}m ago`);
    }
    lines.push('');
    lines.push('Usage: /resume <task-text> to resume a specific pipeline');
    context.addMessage('system', lines.join('\n'));
  },
};
