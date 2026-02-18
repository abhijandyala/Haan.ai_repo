import { eventBus } from '../utils/event-bus.js';
import { logger } from '../utils/logger.js';
import { LoadedPlugin } from './plugin-types.js';

export type HookEvent =
  | 'onInit'
  | 'onBeforeStage'
  | 'onAfterStage'
  | 'onToolCall'
  | 'onComplete';

interface HookHandler {
  pluginName: string;
  event: HookEvent;
  handler: (...args: unknown[]) => void | Promise<void>;
}

const registeredHooks: HookHandler[] = [];

/**
 * Register lifecycle hooks from a loaded plugin.
 * Hooks are wired to the event bus for the corresponding pipeline events.
 */
export function registerPluginHooks(plugin: LoadedPlugin): void {
  const hooks = plugin.manifest.hooks;
  if (!hooks) return;

  const hookMap: Record<HookEvent, string | undefined> = {
    onInit: hooks.onInit,
    onBeforeStage: hooks.onBeforeStage,
    onAfterStage: hooks.onAfterStage,
    onToolCall: hooks.onToolCall,
    onComplete: hooks.onComplete,
  };

  for (const [event, hookPath] of Object.entries(hookMap)) {
    if (!hookPath) continue;

    // The hook handler is expected to be wired via the plugin's activate() method.
    // We register a placeholder here — actual binding happens through the plugin API's `on()`.
    logger.debug('plugin-hooks', `Plugin "${plugin.manifest.name}" declares hook: ${event} -> ${hookPath}`);
  }
}

/**
 * Register a hook handler from a plugin via the plugin API's on() method.
 */
export function addHookHandler(pluginName: string, event: string, handler: (...args: unknown[]) => void): void {
  const hookEvent = mapEventToHook(event);
  if (!hookEvent) {
    logger.warn('plugin-hooks', `Plugin "${pluginName}" tried to register unknown event: ${event}`);
    return;
  }

  registeredHooks.push({ pluginName, event: hookEvent, handler });

  // Wire to event bus using the underlying EventEmitter to avoid strict typing
  const busEvent = mapHookToEventBus(hookEvent);
  if (busEvent) {
    (eventBus as NodeJS.EventEmitter).on(busEvent, (...args: unknown[]) => {
      try {
        handler(...args);
      } catch (err) {
        logger.error('plugin-hooks', `Hook error in plugin "${pluginName}" (${hookEvent}): ${(err as Error).message}`);
      }
    });
  }

  logger.debug('plugin-hooks', `Registered hook: ${pluginName}:${hookEvent}`);
}

/**
 * Fire all registered hooks for a given event.
 */
export async function fireHooks(event: HookEvent, ...args: unknown[]): Promise<void> {
  const handlers = registeredHooks.filter(h => h.event === event);
  for (const h of handlers) {
    try {
      await h.handler(...args);
    } catch (err) {
      logger.error('plugin-hooks', `Hook error in plugin "${h.pluginName}" (${event}): ${(err as Error).message}`);
    }
  }
}

/**
 * Get all registered hooks.
 */
export function getRegisteredHooks(): readonly HookHandler[] {
  return registeredHooks;
}

/**
 * Clear all hooks (for testing).
 */
export function clearHooks(): void {
  registeredHooks.length = 0;
}

function mapEventToHook(event: string): HookEvent | null {
  const map: Record<string, HookEvent> = {
    'onInit': 'onInit',
    'onBeforeStage': 'onBeforeStage',
    'onAfterStage': 'onAfterStage',
    'onToolCall': 'onToolCall',
    'onComplete': 'onComplete',
    'init': 'onInit',
    'beforeStage': 'onBeforeStage',
    'afterStage': 'onAfterStage',
    'toolCall': 'onToolCall',
    'complete': 'onComplete',
  };
  return map[event] || null;
}

function mapHookToEventBus(hook: HookEvent): string | null {
  const map: Record<HookEvent, string> = {
    onInit: 'pipeline:start',
    onBeforeStage: 'pipeline:stage_start',
    onAfterStage: 'pipeline:stage_complete',
    onToolCall: 'agent:tool_call',
    onComplete: 'pipeline:complete',
  };
  return map[hook] || null;
}
