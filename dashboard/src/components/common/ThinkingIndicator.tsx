import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Brain, Code2, FlaskConical, Bug, Search, Wrench } from 'lucide-react';

interface ThinkingIndicatorProps {
  startedAt?: number | null;
  label?: string;
}

const STAGE_META: Record<string, { icon: typeof Brain; color: string; verb: string; descriptions: string[] }> = {
  planning: {
    icon: Brain,
    color: 'var(--accent)',
    verb: 'Planning',
    descriptions: [
      'Analyzing your task...',
      'Breaking down requirements...',
      'Identifying files to create...',
      'Designing architecture...',
      'Mapping dependencies...',
      'Crafting implementation plan...',
    ],
  },
  building: {
    icon: Code2,
    color: '#7ee787',
    verb: 'Building',
    descriptions: [
      'Writing code...',
      'Creating files...',
      'Implementing features...',
      'Building components...',
      'Generating modules...',
    ],
  },
  testing: {
    icon: FlaskConical,
    color: '#79c0ff',
    verb: 'Testing',
    descriptions: [
      'Running tests...',
      'Checking functionality...',
      'Verifying behavior...',
      'Validating output...',
    ],
  },
  debugging: {
    icon: Bug,
    color: '#f85149',
    verb: 'Debugging',
    descriptions: [
      'Analyzing failures...',
      'Tracing root cause...',
      'Investigating errors...',
      'Finding the bug...',
    ],
  },
  reviewing: {
    icon: Search,
    color: '#d2a8ff',
    verb: 'Reviewing',
    descriptions: [
      'Reviewing code quality...',
      'Checking for issues...',
      'Evaluating architecture...',
      'Assessing performance...',
    ],
  },
};

export default function ThinkingIndicator({ startedAt, label }: ThinkingIndicatorProps) {
  const [elapsed, setElapsed] = useState(0);
  const [descIndex, setDescIndex] = useState(0);

  // Determine which stage we're in from the label
  const stageName = label?.split(' ')[0]?.toLowerCase() || '';
  const meta = STAGE_META[stageName];

  useEffect(() => {
    if (!startedAt) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  // Rotate description text every 3 seconds
  useEffect(() => {
    if (!meta) return;
    const interval = setInterval(() => {
      setDescIndex((i) => (i + 1) % meta.descriptions.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [meta]);

  const formatTime = (s: number) => {
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  const Icon = meta?.icon || Wrench;
  const color = meta?.color || 'var(--accent)';
  const displayLabel = meta?.verb || label || 'Thinking';

  // Check if a tool is active (label contains "Using")
  const isToolActive = label?.startsWith('Using ');
  const toolName = isToolActive ? label!.replace('Using ', '') : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        borderRadius: 'var(--radius-lg)',
        backgroundColor: 'var(--surface-2)',
        border: '1px solid var(--border)',
        width: '100%',
        maxWidth: 480,
      }}
    >
      {/* Animated icon */}
      <div style={{
        position: 'relative',
        width: 36,
        height: 36,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {/* Pulsing ring */}
        <motion.div
          animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: `2px solid ${color}`,
          }}
        />
        {/* Icon background */}
        <div style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          backgroundColor: `${color}15`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {isToolActive ? (
            <Wrench size={15} style={{ color, animation: 'spin 2s linear infinite' }} />
          ) : (
            <Icon size={15} style={{ color }} />
          )}
        </div>
      </div>

      {/* Text content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span style={{
            fontSize: 'var(--font-size-sm)',
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}>
            {isToolActive ? toolName : displayLabel}
          </span>
          {startedAt && elapsed > 0 && (
            <span style={{
              fontSize: 10,
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
              padding: '1px 6px',
              borderRadius: 'var(--radius-xs)',
              backgroundColor: 'var(--surface-3)',
            }}>
              {formatTime(elapsed)}
            </span>
          )}
        </div>
        {/* Rotating description */}
        {!isToolActive && meta && (
          <motion.div
            key={descIndex}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              fontSize: 11,
              color: 'var(--text-tertiary)',
              marginTop: 2,
            }}
          >
            {meta.descriptions[descIndex]}
          </motion.div>
        )}
        {isToolActive && (
          <div style={{
            fontSize: 11,
            color: 'var(--text-tertiary)',
            marginTop: 2,
          }}>
            Executing tool...
          </div>
        )}
      </div>

      {/* Activity dots */}
      <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
            style={{
              width: 4,
              height: 4,
              borderRadius: '50%',
              backgroundColor: color,
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}
