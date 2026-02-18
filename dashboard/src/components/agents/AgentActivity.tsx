import { useStore } from '../../store';
import { motion } from 'framer-motion';
import AgentBadge from './AgentBadge';
import ThinkingIndicator from '../common/ThinkingIndicator';

export default function AgentActivity() {
  const activeAgent = useStore((s) => s.activeAgent);
  const activeTool = useStore((s) => s.activeTool);
  const iteration = useStore((s) => s.iteration);
  const thinkingStartedAt = useStore((s) => s.thinkingStartedAt);

  if (!activeAgent) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        padding: 'var(--space-3)',
        backgroundColor: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        margin: 'var(--space-3)',
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 'var(--space-2)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
        }}>
          <AgentBadge agent={activeAgent} />
        </div>
        {iteration > 0 && (
          <span style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--text-tertiary)',
            fontFamily: 'var(--font-mono)',
          }}>
            iter {iteration}
          </span>
        )}
      </div>
      <ThinkingIndicator
        startedAt={thinkingStartedAt}
        label={activeTool ? `Using ${activeTool}` : 'Thinking'}
      />
    </motion.div>
  );
}
