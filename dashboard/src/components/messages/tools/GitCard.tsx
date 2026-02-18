import { motion } from 'framer-motion';
import { GitBranch, GitCommit } from 'lucide-react';

interface GitCardProps {
  tool: string;
  output: string;
  args: Record<string, unknown>;
  isError?: boolean;
}

export default function GitCard({ tool, output, args, isError }: GitCardProps) {
  const isCommit = tool.includes('commit');
  const isDiff = tool.includes('diff');
  const isStatus = tool.includes('status');

  const Icon = isCommit ? GitCommit : GitBranch;
  const label = isCommit ? 'Git Commit' : isDiff ? 'Git Diff' : isStatus ? 'Git Status' : 'Git';

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
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        padding: '8px 12px',
        backgroundColor: 'var(--surface-2)',
      }}>
        <Icon size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{label}</span>
        {typeof args.message === 'string' && <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{args.message.slice(0, 60)}</span>}
      </div>
      <pre style={{
        margin: 0,
        padding: '8px 12px',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        lineHeight: 1.5,
        color: isError ? 'var(--error)' : 'var(--text-secondary)',
        maxHeight: 200,
        overflow: 'auto',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
        backgroundColor: 'var(--bg)',
      }}>
        {output}
      </pre>
    </motion.div>
  );
}
