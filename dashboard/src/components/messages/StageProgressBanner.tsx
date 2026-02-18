import { motion } from 'framer-motion';
import { useStore } from '../../store';
import { CheckCircle, XCircle, Loader, Circle } from 'lucide-react';

const STAGE_LABELS: Record<string, string> = {
  planning: 'Plan',
  building: 'Build',
  testing: 'Test',
  debugging: 'Debug',
  reviewing: 'Review',
};

export default function StageProgressBanner() {
  const stages = useStore((s) => s.stages);
  const isRunning = useStore((s) => s.isRunning);

  if (stages.length === 0 && !isRunning) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '10px 16px',
        backgroundColor: 'var(--surface-2)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        margin: 'var(--space-2) 0',
      }}
    >
      {stages.map((stage, i) => {
        const label = STAGE_LABELS[stage.name] || stage.name;
        const isActive = stage.status === 'active';
        const isComplete = stage.status === 'complete';
        const isFailed = stage.status === 'failed';

        return (
          <div key={stage.name} style={{ display: 'flex', alignItems: 'center' }}>
            {i > 0 && (
              <div style={{
                width: 24,
                height: 1,
                backgroundColor: isComplete ? 'var(--success)' : 'var(--border)',
                margin: '0 2px',
              }} />
            )}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 8px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: isActive ? 'rgba(var(--accent-rgb),0.12)' : 'transparent',
              border: isActive ? '1px solid var(--accent)' : '1px solid transparent',
            }}>
              {isComplete && <CheckCircle size={12} style={{ color: 'var(--success)' }} />}
              {isFailed && <XCircle size={12} style={{ color: 'var(--error)' }} />}
              {isActive && <Loader size={12} style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite' }} />}
              {stage.status === 'pending' && <Circle size={12} style={{ color: 'var(--text-muted)' }} />}
              <span style={{
                fontSize: 11,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--accent)' : isComplete ? 'var(--text-primary)' : 'var(--text-muted)',
              }}>
                {label}
              </span>
              {stage.duration !== undefined && (
                <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {(stage.duration / 1000).toFixed(1)}s
                </span>
              )}
            </div>
          </div>
        );
      })}
    </motion.div>
  );
}
