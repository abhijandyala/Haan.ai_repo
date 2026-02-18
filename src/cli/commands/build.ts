import { CommandHandler } from './index.js';

export const buildCommand: CommandHandler = {
  name: 'build',
  description: 'Run the builder agent to implement code',
  usage: '/build <task description>',
  async execute(args, context) {
    if (!args) {
      context.addMessage('system', 'Usage: /build <task description>\nExample: /build implement the user authentication module');
      return;
    }
    context.addMessage('system', `Building: ${args}`);
    await context.runPipeline(args, ['building']);
  },
};
