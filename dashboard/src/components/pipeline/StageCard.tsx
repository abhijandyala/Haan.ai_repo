import { useState } from 'react';
import { StageInfo } from '../../store/pipeline-slice';
import AgentBadge from '../agents/AgentBadge';

interface StageCardProps {
  stage: StageInfo;
}

export default function StageCard({ stage }: StageCardProps) {
  const [expanded, setExpanded] = useState(false);

  const getStatusIcon = () => {
    switch (stage.status) {
      case 'pending':
        return <div style={{
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          backgroundColor: 'var(--text-tertiary)',
        }} />;
      case 'active':
        return <div style={{
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          backgroundColor: 'var(--accent)',
          boxShadow: '0 0 12px var(--accent)',
          animation: 'pulse 2s ease-in-out infinite',
        }} />;
      case 'complete':
        return <div style={{
          width: '16px',
          height: '16px',
          color: 'var(--success)',
          fontWeight: 'bold',
        }}>✓</div>;
      case 'failed':
        return <div style={{
          width: '16px',
          height: '16px',
          color: 'var(--error)',
          fontWeight: 'bold',
        }}>✕</div>;
    }
  };

  const formatDuration = (ms: number) => {
    return (ms / 1000).toFixed(1) + 's';
  };

  return (
    <div style={{
      padding: '12px',
      backgroundColor: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      marginBottom: '8px',
      cursor: stage.output ? 'pointer' : 'default',
    }}
    onClick={() => stage.output && setExpanded(!expanded)}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        {getStatusIcon()}

        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: '14px',
            fontWeight: 500,
            color: 'var(--text-primary)',
            marginBottom: '4px',
          }}>
            {stage.name}
          </div>
          {stage.agent && <AgentBadge agent={stage.agent} />}
        </div>

        {stage.duration !== undefined && (
          <div style={{
            fontSize: '12px',
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-mono)',
          }}>
            {formatDuration(stage.duration)}
          </div>
        )}
      </div>

      {/* Expandable Output */}
      {expanded && stage.output !== undefined && (
        <div style={{
          marginTop: '12px',
          padding: '12px',
          backgroundColor: 'var(--surface-2)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '12px',
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-secondary)',
          maxHeight: '200px',
          overflow: 'auto',
        }}>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {String(typeof stage.output === 'string' ? stage.output : JSON.stringify(stage.output, null, 2))}
          </pre>
        </div>
      )}
    </div>
  );
}
