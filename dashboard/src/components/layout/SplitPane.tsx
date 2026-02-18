import { ReactNode, useState, useRef, useEffect } from 'react';

interface SplitPaneProps {
  leftContent: ReactNode;
  rightContent: ReactNode;
  defaultLeftWidth?: number; // percentage
}

export default function SplitPane({ leftContent, rightContent, defaultLeftWidth = 50 }: SplitPaneProps) {
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newWidth = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftWidth(Math.max(20, Math.min(80, newWidth)));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div ref={containerRef} style={{
      display: 'flex',
      flex: 1,
      overflow: 'hidden',
      position: 'relative',
    }}>
      <div style={{
        width: `${leftWidth}%`,
        overflow: 'auto',
      }}>
        {leftContent}
      </div>

      {/* Divider */}
      <div
        onMouseDown={() => setIsDragging(true)}
        style={{
          width: '4px',
          cursor: 'col-resize',
          backgroundColor: isDragging ? 'var(--border-active)' : 'var(--border)',
          transition: isDragging ? 'none' : 'background-color 0.2s',
          position: 'relative',
        }}
        onMouseEnter={(e) => {
          if (!isDragging) {
            e.currentTarget.style.backgroundColor = 'var(--border-active)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isDragging) {
            e.currentTarget.style.backgroundColor = 'var(--border)';
          }
        }}
      />

      <div style={{
        width: `${100 - leftWidth}%`,
        overflow: 'auto',
      }}>
        {rightContent}
      </div>
    </div>
  );
}
