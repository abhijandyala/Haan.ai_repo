import { CommandHandler, CommandContext } from './index.js';

export const snakeCommand: CommandHandler = {
  name: 'snake',
  description: 'Play a game of Snake',
  usage: '/snake',
  async execute(_args: string, context: CommandContext) {
    context.setView('snake');
  },
};
