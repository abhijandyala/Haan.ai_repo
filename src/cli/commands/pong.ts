import { CommandHandler, CommandContext } from './index.js';

export const pongCommand: CommandHandler = {
  name: 'pong',
  description: 'Play a game of Pong',
  usage: '/pong',
  async execute(_args: string, context: CommandContext) {
    context.setView('pong');
  },
};
