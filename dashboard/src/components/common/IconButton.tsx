import { ReactNode, ButtonHTMLAttributes } from 'react';
import { motion } from 'framer-motion';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'ghost' | 'subtle' | 'solid';
  active?: boolean;
  tooltip?: string;
}

const sizes = {
  sm: { box: 28, icon: 14 },
  md: { box: 32, icon: 16 },
  lg: { box: 40, icon: 20 },
};

export default function IconButton({
  children,
  size = 'md',
  variant = 'ghost',
  active = false,
  tooltip,
  style,
  ...props
}: IconButtonProps) {
  const s = sizes[size];

  const getStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      width: s.box,
      height: s.box,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 'var(--radius-sm)',
      border: 'none',
      cursor: props.disabled ? 'not-allowed' : 'pointer',
      fontSize: s.icon,
      transition: 'var(--transition-fast)',
      flexShrink: 0,
    };

    if (active) {
      return {
        ...base,
        backgroundColor: 'var(--accent-bg)',
        color: 'var(--accent)',
      };
    }

    switch (variant) {
      case 'subtle':
        return {
          ...base,
          backgroundColor: 'var(--surface-2)',
          color: 'var(--text-secondary)',
        };
      case 'solid':
        return {
          ...base,
          backgroundColor: 'var(--surface-3)',
          color: 'var(--text-primary)',
        };
      default:
        return {
          ...base,
          backgroundColor: 'transparent',
          color: 'var(--text-secondary)',
        };
    }
  };

  return (
    <motion.button
      whileHover={{ scale: 1.05, backgroundColor: 'var(--surface-hover)' }}
      whileTap={{ scale: 0.95 }}
      title={tooltip}
      style={{ ...getStyle(), ...style }}
      {...(props as any)}
    >
      {children}
    </motion.button>
  );
}
