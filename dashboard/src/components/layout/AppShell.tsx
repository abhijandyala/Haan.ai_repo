import { ReactNode } from 'react';
import { useStore } from '../../store';

interface AppShellProps {
  topBar: ReactNode;
  sidebar: ReactNode;
  main: ReactNode;
  codePanel: ReactNode;
  input: ReactNode;
}

export default function AppShell({ topBar, sidebar, main, codePanel, input }: AppShellProps) {
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const codePanelOpen = useStore((s) => s.codePanelOpen);

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'var(--bg)',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-sans)',
      overflow: 'hidden',
    }}>
      {topBar}
      <div style={{
        display: 'flex',
        flex: 1,
        overflow: 'hidden',
      }}>
        {/* Sidebar */}
        <div style={{
          width: sidebarOpen ? 'var(--sidebar-width)' : 0,
          overflow: 'hidden',
          transition: 'width 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          flexShrink: 0,
        }}>
          {sidebar}
        </div>

        {/* Main conversation area */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minWidth: 0,
        }}>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {main}
          </div>
          {input}
        </div>

        {/* Code panel */}
        {codePanelOpen && (
          <>
            <div style={{
              width: 1,
              backgroundColor: 'var(--border)',
              flexShrink: 0,
            }} />
            <div style={{
              width: 'var(--code-panel-width)',
              overflow: 'hidden',
              flexShrink: 0,
              transition: 'width 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}>
              {codePanel}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
