import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, ChevronRight, ChevronDown } from 'lucide-react';

interface ReasoningBlockProps {
  content: string;
}

export default function ReasoningBlock({ content }: ReasoningBlockProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        marginBottom: 'var(--space-2)',
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          padding: 'var(--space-2) var(--space-3)',
          width: '100%',
          textAlign: 'left',
          cursor: 'pointer',
          borderRadius: 'var(--radius-sm)',
          backgroundColor: 'var(--surface-2)',
          border: '1px solid var(--border)',
          color: 'var(--text-secondary)',
          fontSize: 'var(--font-size-sm)',
          fontWeight: 500,
          transition: 'var(--transition-fast)',
        }}
      >
        <Brain size={13} style={{ color: 'var(--accent-dim)', flexShrink: 0 }} />
        <span style={{ flex: 1 }}>Reasoning</span>
        {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              padding: 'var(--space-3)',
              paddingLeft: 'var(--space-4)',
              borderLeft: '2px solid var(--accent-dim)',
              marginLeft: 'var(--space-4)',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--text-tertiary)',
              lineHeight: 'var(--line-height-relaxed)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
