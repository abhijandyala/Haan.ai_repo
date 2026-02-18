import { useStore } from '../../store';
import { useEffect, useState } from 'react';

export default function PipelineHeader() {
  const taskDescription = useStore((s) => s.taskDescription);
  const mode = useStore((s) => s.mode);
  const startedAt = useStore((s) => s.startedAt);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) {
      setElapsed(0);
      return;
    }

    const interval = setInterval(() => {
      setElapsed(Date.now() - startedAt);
    }, 1000);

    return () => clearInterval(interval);
  }, [startedAt]);

  const formatElapsed = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  if (!taskDescription) return null;

  return (
    <div style={{
      padding: '16px 20px',
      backgroundColor: 'var(--surface-2)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: '16px',
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: '4px',
        }}>
          {taskDescription}
        </div>
      </div>

      {/* Mode Badge */}
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '6px 12px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: 600,
        background: mode === 'auto' ? 'var(--gradient-fire)' : 'var(--surface-3)',
        color: mode === 'auto' ? '#000' : 'var(--text-primary)',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}>
        {mode}
      </div>

      {/* Elapsed Timer */}
      {startedAt && (
        <div style={{
          fontSize: '14px',
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-mono)',
          minWidth: '80px',
          textAlign: 'right',
        }}>
          {formatElapsed(elapsed)}
        </div>
      )}
    </div>
  );
}
