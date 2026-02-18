import { CommandHandler } from './index.js';
import { costTracker } from '../../utils/cost-tracker.js';

export const costCommand: CommandHandler = {
  name: 'cost',
  description: 'Show token usage and cost breakdown',
  usage: '/cost',
  async execute(_args, context) {
    const summary = costTracker.getSummary();

    const lines = [
      '═══ COST BREAKDOWN ═══',
      '',
      `Total Cost:     $${summary.totalCost.toFixed(4)}`,
      `Input Tokens:   ${summary.totalInputTokens.toLocaleString()}`,
      `Output Tokens:  ${summary.totalOutputTokens.toLocaleString()}`,
      `Total Tokens:   ${summary.totalTokens.toLocaleString()}`,
    ];

    if (Object.keys(summary.byModel).length > 0) {
      lines.push('', 'By Model:');
      for (const [model, data] of Object.entries(summary.byModel)) {
        lines.push(`  ${model}:`);
        lines.push(`    Input: ${data.input.toLocaleString()} | Output: ${data.output.toLocaleString()} | Cost: $${data.cost.toFixed(4)}`);
      }
    }

    context.addMessage('system', lines.join('\n'));
  },
};
