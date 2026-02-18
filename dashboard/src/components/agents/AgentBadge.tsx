import { Clipboard, Hammer, FlaskConical, Bug, Eye, Bot } from 'lucide-react';

interface AgentBadgeProps {
  agent: string;
}

const agentConfig: Record<string, { color: string; icon: typeof Bot }> = {
  planner: { color: 'var(--agent-planner)', icon: Clipboard },
  builder: { color: 'var(--agent-builder)', icon: Hammer },
  tester: { color: 'var(--agent-tester)', icon: FlaskConical },
  debugger: { color: 'var(--agent-debugger)', icon: Bug },
  reviewer: { color: 'var(--agent-reviewer)', icon: Eye },
};

function getConfig(name: string) {
  const lower = name.toLowerCase();
  for (const [key, cfg] of Object.entries(agentConfig)) {
    if (lower.includes(key)) return cfg;
  }
  return { color: 'var(--accent)', icon: Bot };
}

export default function AgentBadge({ agent }: AgentBadgeProps) {
  const { color, icon: Icon } = getConfig(agent);

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '2px 8px',
      borderRadius: 'var(--radius-pill)',
      fontSize: 'var(--font-size-xs)',
      fontWeight: 600,
      backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
      color: color,
      border: `1px solid color-mix(in srgb, ${color} 20%, transparent)`,
    }}>
      <Icon size={11} />
      <span>{agent}</span>
    </span>
  );
}
