import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { getProjectRoot } from '../utils/path-utils.js';
import { toolRegistry } from '../tools/tool-registry.js';
import { eventBus } from '../utils/event-bus.js';
import { logger } from '../utils/logger.js';
import { MemoryManager } from '../memory/memory-manager.js';
import { getConfig } from '../config/config-manager.js';
import {
  PluginManifest,
  LoadedPlugin,
  PluginModule,
  HaanPluginAPI,
  AgentFactory,
  StageConfig,
} from './plugin-types.js';
import { registerPluginHooks, addHookHandler, fireHooks } from './hooks.js';

const loadedPlugins: LoadedPlugin[] = [];
const customAgentFactories: Map<string, AgentFactory> = new Map();
const customStages: Map<string, StageConfig> = new Map();

/**
 * Scan for and load all plugins from:
 *   1. `.haan/plugins/` in the project root
 *   2. `node_modules/haan-plugin-*` in the project root
 */
export async function loadPlugins(): Promise<LoadedPlugin[]> {
  const root = getProjectRoot();

  // 1. Local plugins from .haan/plugins/
  const localPluginDir = path.join(root, '.haan', 'plugins');
  if (fs.existsSync(localPluginDir)) {
    const entries = fs.readdirSync(localPluginDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const pluginPath = path.join(localPluginDir, entry.name);
        try {
          const plugin = await loadSinglePlugin(pluginPath);
          if (plugin) loadedPlugins.push(plugin);
        } catch (err) {
          logger.error('plugin-loader', `Failed to load local plugin "${entry.name}": ${(err as Error).message}`);
        }
      }
    }
  }

  // 2. npm plugins from node_modules/haan-plugin-*
  const nodeModulesDir = path.join(root, 'node_modules');
  if (fs.existsSync(nodeModulesDir)) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(nodeModulesDir, { withFileTypes: true });
    } catch {
      entries = [];
    }
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith('haan-plugin-')) {
        const pluginPath = path.join(nodeModulesDir, entry.name);
        try {
          const plugin = await loadSinglePlugin(pluginPath);
          if (plugin) loadedPlugins.push(plugin);
        } catch (err) {
          logger.error('plugin-loader', `Failed to load npm plugin "${entry.name}": ${(err as Error).message}`);
        }
      }
    }
  }

  // Fire onInit hooks after all plugins are loaded
  if (loadedPlugins.length > 0) {
    logger.info('plugin-loader', `Loaded ${loadedPlugins.length} plugin(s): ${loadedPlugins.map(p => p.manifest.name).join(', ')}`);
    await fireHooks('onInit');
  }

  return loadedPlugins;
}

/**
 * Load a single plugin from a directory.
 */
async function loadSinglePlugin(pluginDir: string): Promise<LoadedPlugin | null> {
  const manifestPath = path.join(pluginDir, 'plugin.json');
  if (!fs.existsSync(manifestPath)) {
    logger.debug('plugin-loader', `No plugin.json found in ${pluginDir}, skipping`);
    return null;
  }

  const manifestRaw = fs.readFileSync(manifestPath, 'utf-8');
  const manifest: PluginManifest = JSON.parse(manifestRaw);

  if (!manifest.name || !manifest.entry) {
    logger.warn('plugin-loader', `Invalid plugin manifest in ${pluginDir}: missing name or entry`);
    return null;
  }

  // Resolve entry point
  const entryPath = path.resolve(pluginDir, manifest.entry);
  if (!fs.existsSync(entryPath)) {
    logger.warn('plugin-loader', `Plugin "${manifest.name}" entry not found: ${entryPath}`);
    return null;
  }

  // Dynamic import the plugin module
  const entryUrl = pathToFileURL(entryPath).href;
  const mod = await import(entryUrl);
  const pluginModule: PluginModule = mod.default || mod;

  if (typeof pluginModule.activate !== 'function') {
    logger.warn('plugin-loader', `Plugin "${manifest.name}" does not export an activate() function`);
    return null;
  }

  const plugin: LoadedPlugin = {
    manifest,
    path: pluginDir,
    module: pluginModule,
  };

  // Create the plugin API
  const api = createPluginAPI(manifest.name);

  // Register hook declarations from manifest
  registerPluginHooks(plugin);

  // Activate the plugin
  await pluginModule.activate(api);

  logger.info('plugin-loader', `Activated plugin: ${manifest.name}@${manifest.version}`);
  return plugin;
}

/**
 * Create a sandboxed Plugin API for a given plugin.
 */
function createPluginAPI(pluginName: string): HaanPluginAPI {
  return {
    registerTool(tool) {
      // Namespace the tool: pluginName:toolName
      const originalName = tool.name;
      tool.name = `${pluginName}:${originalName}`;
      toolRegistry.register(tool);
      logger.info('plugin-loader', `Plugin "${pluginName}" registered tool: ${tool.name}`);
    },

    registerAgent(name, factory) {
      const namespacedName = `${pluginName}:${name}`;
      customAgentFactories.set(namespacedName, factory);
      logger.info('plugin-loader', `Plugin "${pluginName}" registered agent: ${namespacedName}`);
    },

    registerStage(name, config) {
      const namespacedName = `${pluginName}:${name}`;
      customStages.set(namespacedName, config);
      logger.info('plugin-loader', `Plugin "${pluginName}" registered stage: ${namespacedName}`);
    },

    on(event, handler) {
      addHookHandler(pluginName, event, handler);
    },

    getConfig() {
      return getConfig() as unknown as Record<string, unknown>;
    },

    getMemory() {
      return new MemoryManager(getProjectRoot());
    },
  };
}

/**
 * Get all loaded plugins.
 */
export function getLoadedPlugins(): readonly LoadedPlugin[] {
  return loadedPlugins;
}

/**
 * Get a custom agent factory registered by a plugin.
 */
export function getCustomAgentFactory(name: string): AgentFactory | undefined {
  return customAgentFactories.get(name);
}

/**
 * Get a custom stage config registered by a plugin.
 */
export function getCustomStage(name: string): StageConfig | undefined {
  return customStages.get(name);
}

/**
 * Get all custom stage names.
 */
export function getCustomStageNames(): string[] {
  return Array.from(customStages.keys());
}
