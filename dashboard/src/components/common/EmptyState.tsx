import { motion } from 'framer-motion';
import { Flame, Zap, Code2, FileCode } from 'lucide-react';

interface EmptyStateProps {
  onAction?: (action: string) => void;
}

const suggestions = [
  {
    icon: Code2,
    title: 'Build a feature',
    description: 'Add a new component, endpoint, or module',
    action: 'Build a new feature for my project',
  },
  {
    icon: Zap,
    title: 'Fix a bug',
    description: 'Debug and fix an issue in the codebase',
    action: 'Find and fix bugs in my code',
  },
  {
    icon: FileCode,
    title: 'Refactor code',
    description: 'Improve code quality and architecture',
    action: 'Refactor and improve my codebase',
  },
];

export default function EmptyState({ onAction }: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      padding: 'var(--space-8)',
      gap: 'var(--space-8)',
    }}>
      {/* Logo + Title */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--space-3)',
        }}
      >
        <div style={{
          width: 48, height: 48,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--gradient-fire)',
          boxShadow: 'var(--shadow-glow)',
        }}>
          <Flame size={24} color="#000" />
        </div>
        <h2 style={{
          fontSize: 'var(--font-size-2xl)',
          fontWeight: 700,
          background: 'var(--gradient-brand)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          What should we build?
        </h2>
        <p style={{
          fontSize: 'var(--font-size-md)',
          color: 'var(--text-tertiary)',
          maxWidth: 400,
          textAlign: 'center',
          lineHeight: 'var(--line-height-relaxed)',
        }}>
          Describe a task and the pipeline will plan, build, test, and refine it automatically.
        </p>
      </motion.div>

      {/* Suggestion cards */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 'var(--space-3)',
          maxWidth: 640,
          width: '100%',
        }}
      >
        {suggestions.map((s) => (
          <motion.button
            key={s.title}
            whileHover={{ scale: 1.02, borderColor: 'var(--border-active)' }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onAction?.(s.action)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: 'var(--space-2)',
              padding: 'var(--space-4)',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'var(--transition-normal)',
            }}
          >
            <s.icon size={18} style={{ color: 'var(--accent)' }} />
            <span style={{
              fontSize: 'var(--font-size-sm)',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}>
              {s.title}
            </span>
            <span style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--text-tertiary)',
              lineHeight: 'var(--line-height-normal)',
            }}>
              {s.description}
            </span>
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
}
