export interface ParsedInput {
  type: 'command' | 'message';
  command?: string;
  args?: string;
  raw: string;
}

export function parseInput(input: string): ParsedInput {
  const trimmed = input.trim();

  if (trimmed.startsWith('/')) {
    const spaceIndex = trimmed.indexOf(' ');
    if (spaceIndex === -1) {
      return {
        type: 'command',
        command: trimmed.slice(1).toLowerCase(),
        args: '',
        raw: trimmed,
      };
    }
    return {
      type: 'command',
      command: trimmed.slice(1, spaceIndex).toLowerCase(),
      args: trimmed.slice(spaceIndex + 1).trim(),
      raw: trimmed,
    };
  }

  return { type: 'message', raw: trimmed };
}

/**
 * Auto-detect the user's intent from natural language to decide which
 * pipeline stages to run:
 *
 * - "plan" → only run the planner
 * - "build" → run planner + builder
 * - "test" → only run tester
 * - "debug" → only run debugger
 * - "review" → only run feature engineer
 * - "full" → run the complete pipeline
 */
export function detectIntent(message: string): 'plan' | 'build' | 'test' | 'debug' | 'review' | 'full' {
  const lower = message.toLowerCase();

  // ── Pure planning requests ──
  // Keywords that indicate user wants a plan, NOT implementation
  if (/\b(plan|design|architect|outline|break\s*down|strategy|approach)\b/.test(lower) &&
      !/\b(build|implement|create|write|code|make|add|develop|set\s*up)\b/.test(lower)) {
    return 'plan';
  }

  // ── Pure test requests ──
  if (/\b(test|spec|coverage|unit\s*test|integration\s*test|e2e|write\s*tests?|run\s*tests?|add\s*tests?)\b/.test(lower) &&
      !/\b(build|implement|create|fix|debug)\b/.test(lower)) {
    return 'test';
  }

  // ── Debug / fix requests ──
  // These strongly indicate something is broken
  if (/\b(debug|fix|diagnose|trace|bug|broken|failing|crash|error|issue|not\s*working|doesn'?t\s*work)\b/.test(lower)) {
    return 'debug';
  }

  // ── Review / audit requests ──
  if (/\b(review|audit|check\s*quality|code\s*review|security\s*review|optimize|refactor|improve|clean\s*up)\b/.test(lower) &&
      !/\b(build|implement|create|fix|add|write)\b/.test(lower)) {
    return 'review';
  }

  // ── Default: run full pipeline for any creation / implementation request ──
  // Covers: "build X", "create X", "make X", "implement X", "add X",
  //         "write X", "develop X", "set up X", or any general request
  return 'full';
}
