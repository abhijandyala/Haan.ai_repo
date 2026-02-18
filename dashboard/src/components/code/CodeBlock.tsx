import { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check } from 'lucide-react';

interface CodeBlockProps {
  code: string;
  language?: string;
}

export default function CodeBlock({ code, language = 'typescript' }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        position: 'relative',
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 'var(--space-2) var(--space-3)',
        backgroundColor: 'var(--surface-2)',
        borderBottom: '1px solid var(--border)',
      }}>
        <span style={{
          fontSize: 'var(--font-size-xs)',
          color: 'var(--text-tertiary)',
          fontFamily: 'var(--font-mono)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          {language}
        </span>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleCopy}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 8px',
            fontSize: 'var(--font-size-xs)',
            backgroundColor: copied ? 'var(--success-bg)' : 'var(--surface-3)',
            color: copied ? 'var(--success)' : 'var(--text-tertiary)',
            border: `1px solid ${copied ? 'var(--success)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-xs)',
            cursor: 'pointer',
            fontWeight: 500,
            transition: 'var(--transition-fast)',
          }}
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? 'Copied' : 'Copy'}
        </motion.button>
      </div>

      {/* Code */}
      <pre style={{
        padding: 'var(--space-3)',
        overflow: 'auto',
        maxHeight: 500,
        margin: 0,
        backgroundColor: 'transparent',
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--font-size-sm)',
        lineHeight: 'var(--line-height-relaxed)',
        color: 'var(--text-primary)',
      }}>
        <code>{code}</code>
      </pre>
    </motion.div>
  );
}
