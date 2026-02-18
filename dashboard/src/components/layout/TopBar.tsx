import { useStore } from '../../store';
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Flame, Search, Settings as SettingsIcon } from 'lucide-react';
import IconButton from '../common/IconButton';
import Badge from '../common/Badge';
import Tooltip from '../common/Tooltip';

export default function TopBar() {
  const connected = useStore((s) => s.connected);
  const taskDescription = useStore((s) => s.taskDescription);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const codePanelOpen = useStore((s) => s.codePanelOpen);
  const toggleSidebar = useStore((s) => s.toggleSidebar);
  const toggleCodePanel = useStore((s) => s.toggleCodePanel);
  const setCommandPaletteOpen = useStore((s) => s.setCommandPaletteOpen);
  const toggleSettings = useStore((s) => s.toggleSettings);

  return (
    <header style={{
      height: 'var(--topbar-height)',
      backgroundColor: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      padding: '0 var(--space-3)',
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-3)',
      flexShrink: 0,
      // @ts-expect-error Tauri desktop drag region
      WebkitAppRegion: 'drag',
    }}>
      {/* Left: sidebar toggle + logo */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        // @ts-expect-error Tauri desktop drag region
        WebkitAppRegion: 'no-drag',
      }}>
        <Tooltip content={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}>
          <IconButton onClick={toggleSidebar}>
            {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
          </IconButton>
        </Tooltip>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
        }}>
          <div style={{
            width: 22, height: 22,
            borderRadius: 'var(--radius-sm)',
            background: 'var(--gradient-fire)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Flame size={13} color="#000" strokeWidth={2.5} />
          </div>
          <span style={{
            fontSize: 'var(--font-size-md)',
            fontWeight: 700,
            background: 'var(--gradient-fire)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            haan
          </span>
        </div>
      </div>

      {/* Center: task title */}
      <div style={{
        flex: 1,
        textAlign: 'center',
        fontSize: 'var(--font-size-sm)',
        color: 'var(--text-secondary)',
        fontWeight: 500,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {taskDescription
          ? (taskDescription.length > 80 ? taskDescription.slice(0, 80) + '...' : taskDescription)
          : ''}
      </div>

      {/* Right: actions */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        // @ts-expect-error Tauri desktop drag region
        WebkitAppRegion: 'no-drag',
      }}>
        {/* Cmd+K */}
        <Tooltip content="Command palette">
          <button
            onClick={() => setCommandPaletteOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 8px',
              fontSize: 'var(--font-size-xs)',
              color: 'var(--text-tertiary)',
              backgroundColor: 'var(--surface-2)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              transition: 'var(--transition-fast)',
            }}
          >
            <Search size={11} />
            <kbd style={{ border: 'none', boxShadow: 'none', background: 'none', padding: 0, minWidth: 0, height: 'auto' }}>
              {typeof navigator !== 'undefined' && navigator.platform?.includes('Mac') ? '\u2318' : 'Ctrl+'}K
            </kbd>
          </button>
        </Tooltip>

        <Tooltip content="Settings">
          <IconButton onClick={toggleSettings}>
            <SettingsIcon size={15} />
          </IconButton>
        </Tooltip>

        {/* Connection dot + badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <div style={{
            width: 7, height: 7,
            borderRadius: '50%',
            backgroundColor: connected ? 'var(--success)' : 'var(--error)',
            boxShadow: connected ? '0 0 6px var(--success)' : 'none',
            animation: connected ? 'statusPulse 2s ease-in-out infinite' : 'none',
          }} />
          <Badge variant={connected ? 'success' : 'error'}>
            {connected ? 'Live' : 'Offline'}
          </Badge>
        </div>

        {/* Code panel toggle */}
        <Tooltip content={codePanelOpen ? 'Hide code' : 'Show code'}>
          <IconButton onClick={toggleCodePanel}>
            {codePanelOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
          </IconButton>
        </Tooltip>
      </div>
    </header>
  );
}
