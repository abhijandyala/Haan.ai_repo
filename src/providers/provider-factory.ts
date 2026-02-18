import { IProvider } from './types.js';
import { AnthropicProvider } from './anthropic-provider.js';
import { OpenAIProvider } from './openai-provider.js';
import { GoogleProvider } from './google-provider.js';
import { FailoverProvider } from './failover-provider.js';
import { getConfig } from '../config/config-manager.js';
import { logger } from '../utils/logger.js';

/**
 * Map of provider name -> fallback model IDs.
 * If the primary provider fails, we try these in order.
 */
const DEFAULT_FALLBACKS: Record<string, string[]> = {
  openai: ['claude-sonnet-4-5', 'gemini-2.5-pro'],
  anthropic: ['gpt-5.2-codex', 'gemini-2.5-pro'],
  google: ['gpt-5.2-codex', 'claude-sonnet-4-5'],
};

export function createProvider(modelId: string): IProvider {
  const config = getConfig();

  // Determine provider from model ID
  if (modelId.startsWith('claude') || modelId.startsWith('anthropic')) {
    const key = config.providers.anthropic.apiKey;
    if (!key) throw new Error('Anthropic API key not configured. Set ANTHROPIC_API_KEY or run /config providers.anthropic.apiKey <key>');
    return new AnthropicProvider(key, modelId);
  }

  if (modelId.startsWith('gpt') || modelId.startsWith('o1') || modelId.startsWith('o3') || modelId.startsWith('o4') || modelId.startsWith('codex')) {
    const key = config.providers.openai.apiKey;
    if (!key) throw new Error('OpenAI API key not configured. Set OPENAI_API_KEY or run /config providers.openai.apiKey <key>');
    return new OpenAIProvider(key, modelId);
  }

  if (modelId.startsWith('gemini')) {
    const key = config.providers.google.apiKey;
    if (!key) throw new Error('Google AI API key not configured. Set GOOGLE_AI_API_KEY or run /config providers.google.apiKey <key>');
    return new GoogleProvider(key, modelId);
  }

  throw new Error(`Unknown model: ${modelId}. Supported prefixes: claude, gpt, o1, o3, o4, gemini`);
}

/**
 * Create a provider with automatic failover for a given role.
 * Builds a chain: primary provider + any fallback providers that have valid keys.
 */
export function createProviderForRole(role: 'planner' | 'builder' | 'tester' | 'debugger' | 'featureEngineer'): IProvider {
  const config = getConfig();
  const modelId = config.models[role];
  const primary = createProvider(modelId);

  // Build fallback chain from available providers with valid keys
  const providerName = primary.name;
  const fallbackModels = DEFAULT_FALLBACKS[providerName] || [];
  const fallbackProviders: IProvider[] = [];

  for (const fallbackModelId of fallbackModels) {
    try {
      const fallback = createProvider(fallbackModelId);
      fallbackProviders.push(fallback);
    } catch {
      // No key for this fallback — skip silently
    }
  }

  if (fallbackProviders.length === 0) {
    return primary;
  }

  logger.debug('provider-factory', `Created failover chain for ${role}: ${modelId} -> ${fallbackProviders.map(p => p.model).join(' -> ')}`);
  return new FailoverProvider([primary, ...fallbackProviders]);
}
