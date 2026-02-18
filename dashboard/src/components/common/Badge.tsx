import { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  variant?: 'success' | 'error' | 'warning' | 'info' | 'default' | 'accent';
  size?: 'sm' | 'md';
}

const variantStyles: Record<string, { bg: string; color: string; border: string }> = {
  success: {
    bg: 'var(--success-bg)',
    color: 'var(--success)',
    border: 'rgba(16, 185, 129, 0.2)',
  },
  error: {
    bg: 'var(--error-bg)',
    color: 'var(--error)',
    border: 'rgba(239, 68, 68, 0.2)',
  },
  warning: {
    bg: 'var(--warning-bg)',
    color: 'var(--warning)',
    border: 'rgba(245, 158, 11, 0.2)',
  },
  info: {
    bg: 'var(--info-bg)',
    color: 'var(--info)',
    border: 'rgba(59, 130, 246, 0.2)',
  },
  accent: {
    bg: 'var(--accent-bg)',
    color: 'var(--accent)',
    border: 'rgba(245, 158, 11, 0.2)',
  },
  default: {
    bg: 'var(--surface-3)',
    color: 'var(--text-secondary)',
    border: 'var(--border)',
  },
};

export default function Badge({ children, variant = 'default', size = 'sm' }: BadgeProps) {
  const s = variantStyles[variant] || variantStyles.default;
  const isSm = size === 'sm';

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: isSm ? '2px 6px' : '3px 8px',
      borderRadius: 'var(--radius-xs)',
      fontSize: isSm ? 'var(--font-size-xs)' : 'var(--font-size-sm)',
      fontWeight: 600,
      letterSpacing: '0.3px',
      backgroundColor: s.bg,
      color: s.color,
      border: `1px solid ${s.border}`,
      lineHeight: 1.4,
    }}>
      {children}
    </span>
  );
}
