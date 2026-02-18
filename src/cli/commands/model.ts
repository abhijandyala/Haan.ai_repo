import { CommandHandler } from './index.js';
import { getConfig, setConfigValue } from '../../config/config-manager.js';

const ROLES = ['planner', 'builder', 'tester', 'debugger', 'featureEngineer'] as const;

export const modelCommand: CommandHandler = {
  name: 'model',
  description: 'View or change model assignments',
  usage: '/model [role] [model-id]',
  async execute(args, context) {
    const config = getConfig();

    if (!args) {
      const lines = [
        '═══ MODEL ASSIGNMENTS ═══',
        '',
        ...ROLES.map(role => {
          const model = config.models[role];
          const provider =
            model.startsWith('claude') ? 'Anthropic' :
            model.startsWith('gpt') || model.startsWith('o') || model.includes('codex') ? 'OpenAI' :
            model.startsWith('gemini') ? 'Google' : 'Unknown';
          return `  ${role.padEnd(18)} ${model.padEnd(30)} [${provider}]`;
        }),
        '',
        'Usage: /model <role> <model-id>',
        `Roles: ${ROLES.join(', ')}`,
      ];
      context.addMessage('system', lines.join('\n'));
      return;
    }

    const parts = args.split(/\s+/);
    if (parts.length === 1) {
      const role = parts[0] as typeof ROLES[number];
      if (!ROLES.includes(role)) {
        context.addMessage('system', `Unknown role: ${role}\nValid roles: ${ROLES.join(', ')}`);
        return;
      }
      context.addMessage('system', `${role} = ${config.models[role]}`);
      return;
    }

    const role = parts[0] as typeof ROLES[number];
    const modelId = parts[1];

    if (!ROLES.includes(role)) {
      context.addMessage('system', `Unknown role: ${role}\nValid roles: ${ROLES.join(', ')}`);
      return;
    }

    setConfigValue(`models.${role}`, modelId);
    context.addMessage('system', `Set ${role} model to: ${modelId}`);
  },
};
