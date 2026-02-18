import { CommandHandler } from './index.js';
import { getConfigValue, setConfigValue } from '../../config/config-manager.js';

export const configCommand: CommandHandler = {
  name: 'config',
  description: 'View or update configuration',
  usage: '/config [key] [value]',
  async execute(args, context) {
    if (!args) {
      // Show full config (mask API keys)
      const config = context.getConfig() as Record<string, unknown>;
      const masked = JSON.parse(JSON.stringify(config));
      const providers = (masked as { providers?: Record<string, { apiKey?: string }> }).providers;
      if (providers) {
        for (const p of Object.values(providers)) {
          if (p.apiKey) p.apiKey = p.apiKey.slice(0, 8) + '...' + p.apiKey.slice(-4);
        }
      }
      context.addMessage('system', '═══ CONFIGURATION ═══\n' + JSON.stringify(masked, null, 2));
      return;
    }

    const parts = args.split(/\s+/);
    if (parts.length === 1) {
      const value = getConfigValue(parts[0]);
      context.addMessage('system', `${parts[0]} = ${JSON.stringify(value)}`);
    } else {
      const key = parts[0];
      const value = parts.slice(1).join(' ');
      let parsed: unknown = value;
      if (value === 'true') parsed = true;
      else if (value === 'false') parsed = false;
      else if (!isNaN(Number(value))) parsed = Number(value);
      setConfigValue(key, parsed);
      context.addMessage('system', `Set ${key} = ${JSON.stringify(parsed)}`);
    }
  },
};
