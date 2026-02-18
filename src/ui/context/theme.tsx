import chalk, { type ChalkInstance } from 'chalk';

export const theme = {
  agents: {
    planner: { color: '#A78BFA', label: 'PLANNER', icon: '\u{1F9E0}' },
    builder: { color: '#34D399', label: 'BUILDER', icon: '\u{1F528}' },
    tester: { color: '#60A5FA', label: 'TESTER', icon: '\u{1F9EA}' },
    debugger: { color: '#F87171', label: 'DEBUGGER', icon: '\u{1F50D}' },
    'feature-engineer': { color: '#FBBF24', label: 'REVIEWER', icon: '\u{2B50}' },
    orchestrator: { color: '#F472B6', label: 'HAAN', icon: '\u{2728}' },
  },
  ui: {
    primary: '#818CF8',
    secondary: '#A78BFA',
    success: '#34D399',
    error: '#F87171',
    warning: '#FBBF24',
    info: '#60A5FA',
    muted: '#6B7280',
    dim: '#4B5563',
    border: '#374151',
    bg: '#111827',
    text: '#F9FAFB',
  },
  gradients: {
    header: ['#06b6d4', '#8b5cf6', '#ec4899'] as string[],
    success: ['#34d399', '#06b6d4'] as string[],
    error: ['#f87171', '#ef4444'] as string[],
  },
};

export function agentColor(agentName: string): ChalkInstance {
  const agent = theme.agents[agentName as keyof typeof theme.agents];
  return chalk.hex(agent?.color || theme.ui.primary);
}

export function agentMeta(agentName: string) {
  return theme.agents[agentName as keyof typeof theme.agents] || {
    color: theme.ui.primary,
    label: agentName.toUpperCase(),
    icon: '\u{2728}',
  };
}

export function uiColor(name: keyof typeof theme.ui): ChalkInstance {
  return chalk.hex(theme.ui[name]);
}
