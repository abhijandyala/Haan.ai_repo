import { CommandHandler } from './index.js';

export const modeCommand: CommandHandler = {
  name: 'mode',
  description: 'Switch between auto and human-aided modes',
  usage: '/mode [auto|human]',
  async execute(args, context) {
    if (!args) {
      const config = context.getConfig() as { mode?: string };
      const current = config.mode || 'human';
      const next = current === 'auto' ? 'human' : 'auto';
      context.setMode(next as 'auto' | 'human');
      context.addMessage('system', `Switched to ${next.toUpperCase()} mode`);
      return;
    }

    const mode = args.toLowerCase();
    if (mode !== 'auto' && mode !== 'human') {
      context.addMessage('system', 'Usage: /mode [auto|human]');
      return;
    }

    context.setMode(mode);
    context.addMessage('system', `Mode set to ${mode.toUpperCase()}\n${mode === 'auto'
      ? 'Pipeline will run fully autonomously without pausing for approval.'
      : 'Pipeline will pause between stages for your approval.'}`);
  },
};
