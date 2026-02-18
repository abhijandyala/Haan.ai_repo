import { motion } from 'framer-motion';
import { Search, File } from 'lucide-react';

interface SearchResultCardProps {
  query: string;
  output: string;
  isError?: boolean;
}

export default function SearchResultCard({ query, output, isError }: SearchResultCardProps) {
  const lines = output.split('\n').filter(Boolean).slice(0, 20);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${isError ? 'var(--error)' : 'var(--border)'}`,
        overflow: 'hidden',
        marginTop: 'var(--space-2)',
        backgroundColor: 'var(--surface-2)',
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        padding: '8px 12px',
        borderBottom: '1px solid var(--border)',
      }}>
        <Search size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--text-secondary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {query}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>{lines.length} results</span>
      </div>
      <div style={{ maxHeight: 200, overflow: 'auto' }}>
        {lines.map((line, i) => (
          <div key={i} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 12px',
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-secondary)',
            borderBottom: i < lines.length - 1 ? '1px solid var(--border)' : 'none',
          }}>
            <File size={10} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{line}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
