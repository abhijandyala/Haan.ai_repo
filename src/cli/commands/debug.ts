import { CommandHandler } from './index.js';

export const debugCommand: CommandHandler = {
  name: 'debug',
  description: 'Run the debugger agent to find and fix issues',
  usage: '/debug [error description or file path]',
  async execute(args, context) {
    const task = args || 'Analyze recent test failures and fix any bugs found';
    context.addMessage('system', `Debugging: ${task}`);
    await context.runPipeline(task, ['debugging']);
  },
};
