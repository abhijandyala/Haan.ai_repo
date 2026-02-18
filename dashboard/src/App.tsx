import { useWebSocket } from './hooks/useWebSocket';
import { useStore } from './store';
import AppShell from './components/layout/AppShell';
import TopBar from './components/layout/TopBar';
import Sidebar from './components/layout/Sidebar';
import MessageFeed from './components/messages/MessageFeed';
import CodePanel from './components/code/CodePanel';
import TaskInput from './components/input/TaskInput';
import CommandPalette from './components/input/CommandPalette';
import SettingsPanel from './components/settings/SettingsPanel';
import Toast from './components/common/Toast';

export default function App() {
  useWebSocket();
  const toasts = useStore((s) => s.toasts);
  const removeToast = useStore((s) => s.removeToast);

  return (
    <>
      <AppShell
        topBar={<TopBar />}
        sidebar={<Sidebar />}
        main={<MessageFeed />}
        codePanel={<CodePanel />}
        input={<TaskInput />}
      />

      {/* Command Palette */}
      <CommandPalette />

      {/* Settings Panel */}
      <SettingsPanel />

      {/* Toast Notifications */}
      <div style={{
        position: 'fixed',
        top: 'var(--space-5)',
        right: 'var(--space-5)',
        zIndex: 'var(--z-toast)' as any,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
      }}>
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </>
  );
}
