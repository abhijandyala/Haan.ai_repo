import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Info } from 'lucide-react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
  onClose?: () => void;
}

const icons = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
};

const colors = {
  success: { bg: 'var(--success-bg)', border: 'rgba(16, 185, 129, 0.25)', text: 'var(--success)' },
  error: { bg: 'var(--error-bg)', border: 'rgba(239, 68, 68, 0.25)', text: 'var(--error)' },
  info: { bg: 'var(--surface-2)', border: 'var(--border)', text: 'var(--text-primary)' },
};

export default function Toast({ message, type = 'info', duration = 3000, onClose }: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onClose?.(), 200);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const Icon = icons[type];
  const c = colors[type];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, x: 80, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 80, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: '10px 14px',
            backgroundColor: c.bg,
            border: `1px solid ${c.border}`,
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            minWidth: 220,
            maxWidth: 380,
            backdropFilter: 'blur(12px)',
          }}
        >
          <Icon size={16} style={{ color: c.text, flexShrink: 0 }} />
          <span style={{
            fontSize: 'var(--font-size-sm)',
            fontWeight: 500,
            color: c.text,
            flex: 1,
          }}>
            {message}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
