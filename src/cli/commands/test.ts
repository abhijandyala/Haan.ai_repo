import { CommandHandler } from './index.js';

export const testCommand: CommandHandler = {
  name: 'test',
  description: 'Run the tester agent to generate and execute tests',
  usage: '/test [optional focus area]',
  async execute(args, context) {
    const task = args || 'Run the test suite and generate any missing tests';
    context.addMessage('system', `Testing: ${task}`);
    await context.runPipeline(task, ['testing']);
  },
};
