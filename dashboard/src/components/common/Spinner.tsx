import { motion } from 'framer-motion';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}

const dims = { sm: 14, md: 20, lg: 28 };

export default function Spinner({ size = 'md', color = 'var(--accent)' }: SpinnerProps) {
  const d = dims[size];

  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
      style={{
        display: 'inline-block',
        width: d,
        height: d,
        borderRadius: '50%',
        border: `2px solid transparent`,
        borderTopColor: color,
        borderRightColor: color,
        opacity: 0.8,
        flexShrink: 0,
      }}
    />
  );
}
