import { CommandHandler } from './index.js';

export const planCommand: CommandHandler = {
  name: 'plan',
  description: 'Run the planner agent to create an implementation plan',
  usage: '/plan <task description>',
  async execute(args, context) {
    if (!args) {
      context.addMessage('system', 'Usage: /plan <task description>\nExample: /plan build a REST API with Express');
      return;
    }
    context.addMessage('system', `Planning: ${args}`);
    await context.runPipeline(args, ['planning']);
  },
};
