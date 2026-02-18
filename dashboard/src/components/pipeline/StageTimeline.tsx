import { useStore } from '../../store';
import StageCard from './StageCard';

export default function StageTimeline() {
  const stages = useStore((s) => s.stages);

  if (stages.length === 0) {
    return (
      <div style={{
        padding: '40px 20px',
        textAlign: 'center',
        color: 'var(--text-tertiary)',
        fontSize: '14px',
      }}>
        No stages yet
      </div>
    );
  }

  return (
    <div style={{
      padding: '16px',
      overflow: 'auto',
    }}>
      {stages.map((stage, index) => (
        <div key={stage.name} style={{ position: 'relative' }}>
          <StageCard stage={stage} />
          {index < stages.length - 1 && (
            <div style={{
              height: '20px',
              width: '2px',
              backgroundColor: 'var(--border)',
              marginLeft: '20px',
            }} />
          )}
        </div>
      ))}
    </div>
  );
}
