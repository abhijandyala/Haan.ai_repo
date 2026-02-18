import { useState } from 'react';
import { motion } from 'framer-motion';
import { Terminal, ChevronDown, ChevronRight } from 'lucide-react';

interface TerminalCardProps {
  command: string;
  output: string;
  exitCode?: number;
  isError?: boolean;
}

export default function TerminalCard({ command, output, exitCode, isError }: TerminalCardProps) {
  const [expanded, setExpanded] = useState(!isError);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${isError ? 'var(--error)' : 'var(--border)'}`,
        overflow: 'hidden',
        marginTop: 'var(--space-2)',
        backgroundColor: '#0d1117',
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          padding: '8px 12px',
          backgroundColor: '#161b22',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <Terminal size={13} style={{ color: '#7ee787', flexShrink: 0 }} />
        <code style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--font-size-xs)',
          color: '#e6edf3',
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          $ {command}
        </code>
        {exitCode !== undefined && (
          <span style={{
            fontSize: 10,
            fontFamily: 'var(--font-mono)',
            color: exitCode === 0 ? 'var(--success)' : 'var(--error)',
            padding: '1px 6px',
            borderRadius: 'var(--radius-xs)',
            backgroundColor: exitCode === 0 ? 'rgba(46,160,67,0.15)' : 'rgba(248,81,73,0.15)',
          }}>
            exit {exitCode}
          </span>
        )}
        {expanded ? <ChevronDown size={12} style={{ color: '#8b949e' }} /> : <ChevronRight size={12} style={{ color: '#8b949e' }} />}
      </button>
      {expanded && output && (
        <pre style={{
          margin: 0,
          padding: '8px 12px',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          lineHeight: 1.5,
          color: isError ? '#f85149' : '#e6edf3',
          maxHeight: 300,
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}>
          {output}
        </pre>
      )}
    </motion.div>
  );
}
