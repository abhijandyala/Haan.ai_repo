import { useState } from 'react';
import { motion } from 'framer-motion';
import { FileCode, Plus, Minus } from 'lucide-react';

interface FileEditCardProps {
  filename: string;
  content: string;
  isError?: boolean;
}

export default function FileEditCard({ filename, content, isError }: FileEditCardProps) {
  const [expanded, setExpanded] = useState(true);

  const lines = content.split('\n');
  const addCount = lines.filter(l => l.startsWith('+') && !l.startsWith('+++')).length;
  const removeCount = lines.filter(l => l.startsWith('-') && !l.startsWith('---')).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${isError ? 'var(--error)' : 'var(--border)'}`,
        overflow: 'hidden',
        marginTop: 'var(--space-2)',
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
          backgroundColor: 'var(--surface-2)',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <FileCode size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--text-primary)',
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {filename.split('/').pop()}
        </span>
        {addCount > 0 && (
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 2 }}>
            <Plus size={10} />+{addCount}
          </span>
        )}
        {removeCount > 0 && (
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--error)', display: 'flex', alignItems: 'center', gap: 2 }}>
            <Minus size={10} />-{removeCount}
          </span>
        )}
      </button>
      {expanded && (
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          maxHeight: 300,
          overflow: 'auto',
          backgroundColor: 'var(--bg)',
        }}>
          {lines.map((line, i) => {
            let bg = 'transparent';
            let color = 'var(--text-secondary)';
            if (line.startsWith('+') && !line.startsWith('+++')) { bg = 'rgba(46,160,67,0.15)'; color = '#3fb950'; }
            else if (line.startsWith('-') && !line.startsWith('---')) { bg = 'rgba(248,81,73,0.15)'; color = '#f85149'; }
            else if (line.startsWith('@@')) { color = 'var(--accent)'; bg = 'rgba(var(--accent-rgb),0.08)'; }
            return (
              <div key={i} style={{ display: 'flex', backgroundColor: bg, lineHeight: '20px', paddingRight: 8 }}>
                <span style={{ minWidth: 36, textAlign: 'right', paddingRight: 8, color: 'var(--text-muted)', userSelect: 'none', fontSize: 10 }}>{i + 1}</span>
                <span style={{ color, whiteSpace: 'pre', flex: 1 }}>{line}</span>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
