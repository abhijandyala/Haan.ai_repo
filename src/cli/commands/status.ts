import { CommandHandler } from './index.js';
import { costTracker } from '../../utils/cost-tracker.js';

export const statusCommand: CommandHandler = {
  name: 'status',
  description: 'Show current pipeline and agent status',
  usage: '/status',
  async execute(_args, context) {
    const config = context.getConfig() as Record<string, unknown>;
    const costs = costTracker.getSummary();

    const lines = [
      '═══ HAAN.AI STATUS ═══',
      '',
      `Mode: ${(config as { mode?: string }).mode || 'human'}`,
      `Total Tokens: ${costs.totalTokens.toLocaleString()}`,
      `Total Cost: $${costs.totalCost.toFixed(4)}`,
      '',
      'Models:',
      ...Object.entries((config as { models?: Record<string, string> }).models || {}).map(
        ([role, model]) => `  ${role}: ${model}`
      ),
    ];

    context.addMessage('system', lines.join('\n'));
  },
};
