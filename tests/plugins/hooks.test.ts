import { describe, it, expect, beforeEach } from 'vitest';
import { addHookHandler, fireHooks, getRegisteredHooks, clearHooks } from '../../src/plugins/hooks.js';

describe('Plugin Hooks', () => {
  beforeEach(() => {
    clearHooks();
  });

  it('should register and fire hooks', async () => {
    let called = false;
    addHookHandler('test-plugin', 'onComplete', () => {
      called = true;
    });
    expect(getRegisteredHooks().length).toBe(1);
    await fireHooks('onComplete', { success: true });
    expect(called).toBe(true);
  });

  it('should handle multiple hooks for same event', async () => {
    let count = 0;
    addHookHandler('plugin-a', 'onInit', () => { count++; });
    addHookHandler('plugin-b', 'onInit', () => { count++; });
    await fireHooks('onInit');
    expect(count).toBe(2);
  });

  it('should not crash on hook errors', async () => {
    addHookHandler('buggy-plugin', 'onComplete', () => {
      throw new Error('Hook crashed');
    });
    // Should not throw
    await fireHooks('onComplete');
  });

  it('should reject unknown events', () => {
    addHookHandler('test-plugin', 'unknownEvent', () => {});
    expect(getRegisteredHooks().length).toBe(0);
  });

  it('should support alternate event names', async () => {
    let called = false;
    addHookHandler('test-plugin', 'beforeStage', () => { called = true; });
    expect(getRegisteredHooks().length).toBe(1);
    await fireHooks('onBeforeStage', { stage: 'building' });
    expect(called).toBe(true);
  });
});
