import { CommandHandler, getAllCommands } from './index.js';
import chalk from 'chalk';

export const helpCommand: CommandHandler = {
  name: 'help',
  description: 'Show all available commands',
  usage: '/help',
  async execute(_args, context) {
    const commands = getAllCommands();
    const lines = [
      '═══ HAAN.AI COMMANDS ═══',
      '',
      'Just type naturally to start the full autonomous pipeline.',
      'Or use slash commands for specific actions:',
      '',
    ];

    const maxLen = Math.max(...commands.map(c => c.usage.length));

    for (const cmd of commands) {
      lines.push(`  ${cmd.usage.padEnd(maxLen + 2)}  ${cmd.description}`);
    }

    lines.push('');
    lines.push('  /quit, /exit                  Exit haan.ai');
    lines.push('');
    lines.push('Modes:');
    lines.push('  AUTO   - Full autonomous pipeline (plan → build → test → debug → review)');
    lines.push('  HUMAN  - Step-by-step with approval between stages');

    context.addMessage('system', lines.join('\n'));
  },
};
