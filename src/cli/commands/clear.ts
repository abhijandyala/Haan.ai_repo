import { CommandHandler } from './index.js';

export const clearCommand: CommandHandler = {
  name: 'clear',
  description: 'Clear the conversation display',
  usage: '/clear',
  async execute(_args, context) {
    context.clearMessages();
  },
};
