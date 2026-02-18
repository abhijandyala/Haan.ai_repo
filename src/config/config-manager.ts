import fs from 'fs';
import path from 'path';
import { HaanConfig } from './types.js';
import { DEFAULT_CONFIG } from './defaults.js';
import { haanDir } from '../utils/path-utils.js';

let currentConfig: HaanConfig = { ...DEFAULT_CONFIG };

function configPath(): string {
  return path.join(haanDir(), 'config.json');
}

export function loadConfig(): HaanConfig {
  const cfgPath = configPath();

  // Start with defaults
  currentConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

  // Overlay file config
  if (fs.existsSync(cfgPath)) {
    try {
      const fileConfig = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
      currentConfig = deepMerge(currentConfig, fileConfig) as HaanConfig;
    } catch (err) {
      // Corrupted config, use defaults — warn via stderr since logger may not be ready
      process.stderr.write(`Warning: Failed to parse config at ${cfgPath}: ${(err as Error).message}. Using defaults.\n`);
    }
  }

  // Environment variables override everything
  if (process.env.ANTHROPIC_API_KEY) {
    currentConfig.providers.anthropic.apiKey = process.env.ANTHROPIC_API_KEY;
  }
  if (process.env.OPENAI_API_KEY) {
    currentConfig.providers.openai.apiKey = process.env.OPENAI_API_KEY;
  }
  if (process.env.GOOGLE_AI_API_KEY) {
    currentConfig.providers.google.apiKey = process.env.GOOGLE_AI_API_KEY;
  }
  if (process.env.GOOGLE_API_KEY) {
    currentConfig.providers.google.apiKey = process.env.GOOGLE_API_KEY;
  }
  if (process.env.GEMINI_API_KEY) {
    currentConfig.providers.google.apiKey = process.env.GEMINI_API_KEY;
  }

  return currentConfig;
}

export function saveConfig(config?: HaanConfig): void {
  const cfg = config || currentConfig;
  const cfgPath = configPath();
  // Don't save API keys from env vars
  const toSave = JSON.parse(JSON.stringify(cfg));
  if (process.env.ANTHROPIC_API_KEY) toSave.providers.anthropic.apiKey = '';
  if (process.env.OPENAI_API_KEY) toSave.providers.openai.apiKey = '';
  if (process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY) toSave.providers.google.apiKey = '';
  fs.writeFileSync(cfgPath, JSON.stringify(toSave, null, 2));
}

export function getConfig(): HaanConfig {
  return currentConfig;
}

export function updateConfig(updates: Partial<HaanConfig>): HaanConfig {
  currentConfig = deepMerge(currentConfig, updates) as HaanConfig;
  saveConfig();
  return currentConfig;
}

export function setConfigValue(keyPath: string, value: unknown): void {
  const keys = keyPath.split('.');
  let obj: Record<string, unknown> = currentConfig as unknown as Record<string, unknown>;
  for (let i = 0; i < keys.length - 1; i++) {
    if (typeof obj[keys[i]] !== 'object' || obj[keys[i]] === null) return;
    obj = obj[keys[i]] as Record<string, unknown>;
  }
  obj[keys[keys.length - 1]] = value;
  saveConfig();
}

export function getConfigValue(keyPath: string): unknown {
  const keys = keyPath.split('.');
  let obj: unknown = currentConfig;
  for (const key of keys) {
    if (typeof obj !== 'object' || obj === null) return undefined;
    obj = (obj as Record<string, unknown>)[key];
  }
  return obj;
}

function deepMerge(target: unknown, source: unknown): unknown {
  if (typeof target !== 'object' || target === null || typeof source !== 'object' || source === null) {
    return source;
  }
  const result = { ...target as Record<string, unknown> };
  for (const key of Object.keys(source as Record<string, unknown>)) {
    const srcVal = (source as Record<string, unknown>)[key];
    if (key in result && typeof result[key] === 'object' && typeof srcVal === 'object') {
      result[key] = deepMerge(result[key], srcVal);
    } else {
      result[key] = srcVal;
    }
  }
  return result;
}
