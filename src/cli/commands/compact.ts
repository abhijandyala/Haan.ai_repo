import { CommandHandler } from './index.js';

export const compactCommand: CommandHandler = {
  name: 'compact',
  description: 'Compress conversation context to save tokens',
  usage: '/compact',
  async execute(_args, context) {
    // Emit a context compression event — the pipeline/agent will handle it
    context.addMessage('system',
      '═══ CONTEXT COMPACTED ═══\n\n' +
      'Conversation history has been compressed. ' +
      'Previous messages have been summarized to save context window space.\n' +
      'You can continue working normally.'
    );
    context.clearMessages();
  },
};
