import { CommandHandler } from './index.js';

export const reviewCommand: CommandHandler = {
  name: 'review',
  description: 'Run the feature engineer to review code quality',
  usage: '/review [focus area]',
  async execute(args, context) {
    const task = args || 'Review all recent changes for quality, security, and performance';
    context.addMessage('system', `Reviewing: ${task}`);
    await context.runPipeline(task, ['reviewing']);
  },
};
