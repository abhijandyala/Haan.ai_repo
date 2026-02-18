import { motion } from 'framer-motion';

interface DiffViewerProps {
  diff: string;
}

export default function DiffViewer({ diff }: DiffViewerProps) {
  const lines = diff.split('\n');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--font-size-sm)',
        backgroundColor: 'var(--bg)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border)',
        overflow: 'auto',
      }}
    >
      {lines.map((line, index) => {
        let bgColor = 'transparent';
        let textColor = 'var(--text-primary)';
        let borderLeftColor = 'transparent';

        if (line.startsWith('+') && !line.startsWith('+++')) {
          bgColor = 'var(--diff-add-bg)';
          textColor = 'var(--diff-add-text)';
          borderLeftColor = 'var(--diff-add-border)';
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          bgColor = 'var(--diff-remove-bg)';
          textColor = 'var(--diff-remove-text)';
          borderLeftColor = 'var(--diff-remove-border)';
        } else if (line.startsWith('@@')) {
          textColor = 'var(--accent)';
          bgColor = 'var(--accent-bg)';
        } else if (line.startsWith('diff ') || line.startsWith('---') || line.startsWith('+++')) {
          textColor = 'var(--text-tertiary)';
          bgColor = 'var(--surface-2)';
        }

        return (
          <div key={index} style={{
            display: 'flex',
            backgroundColor: bgColor,
            borderLeft: `2px solid ${borderLeftColor}`,
            minHeight: 20,
          }}>
            <span style={{
              minWidth: 44,
              textAlign: 'right',
              paddingRight: 'var(--space-3)',
              paddingLeft: 'var(--space-2)',
              color: 'var(--diff-line-number)',
              userSelect: 'none',
              fontSize: 'var(--font-size-xs)',
              lineHeight: '20px',
            }}>
              {index + 1}
            </span>
            <span style={{
              color: textColor,
              flex: 1,
              whiteSpace: 'pre',
              paddingRight: 'var(--space-3)',
              lineHeight: '20px',
            }}>
              {line}
            </span>
          </div>
        );
      })}
    </motion.div>
  );
}
