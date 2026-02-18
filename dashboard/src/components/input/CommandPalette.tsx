import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../store';
import { Terminal, Trash2, Unplug, Search, RotateCcw } from 'lucide-react';

interface Command {
  id: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  action: () => void;
}

export default function CommandPalette() {
  const isOpen = useStore((s) => s.commandPaletteOpen);
  const setOpen = useStore((s) => s.setCommandPaletteOpen);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = useStore((s) => s.reset);
  const clearMessages = useStore((s) => s.clearMessages);
  const disconnect = useStore((s) => s.disconnect);

  const commands: Command[] = [
    {
      id: 'new-pipeline',
      icon: <RotateCcw size={14} />,
      label: 'New Pipeline',
      description: 'Reset and start fresh',
      action: () => { reset(); setOpen(false); },
    },
    {
      id: 'clear-messages',
      icon: <Trash2 size={14} />,
      label: 'Clear Messages',
      description: 'Remove all messages from view',
      action: () => { clearMessages(); setOpen(false); },
    },
    {
      id: 'disconnect',
      icon: <Unplug size={14} />,
      label: 'Disconnect',
      description: 'Close WebSocket connection',
      action: () => { disconnect(); setOpen(false); },
    },
  ];

  const filteredCommands = commands.filter((cmd) =>
    cmd.label.toLowerCase().includes(search.toLowerCase()) ||
    cmd.description.toLowerCase().includes(search.toLowerCase())
  );

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(!isOpen);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, setOpen]);

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filteredCommands.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        filteredCommands[selectedIndex]?.action();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredCommands, setOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '18vh',
            zIndex: 'var(--z-command-palette)' as any,
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 480,
              maxHeight: 360,
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border-active)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-xl)',
              overflow: 'hidden',
            }}
          >
            {/* Search input */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-3) var(--space-4)',
              borderBottom: '1px solid var(--border)',
            }}>
              <Search size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSelectedIndex(0);
                }}
                placeholder="Search commands..."
                style={{
                  flex: 1,
                  padding: '4px 0',
                  fontSize: 'var(--font-size-md)',
                  color: 'var(--text-primary)',
                  backgroundColor: 'transparent',
                  border: 'none',
                  outline: 'none',
                }}
              />
              <kbd>ESC</kbd>
            </div>

            {/* Command list */}
            <div style={{
              maxHeight: 280,
              overflowY: 'auto',
              padding: 'var(--space-1)',
            }}>
              {filteredCommands.map((cmd, index) => (
                <motion.div
                  key={cmd.id}
                  onClick={() => cmd.action()}
                  onMouseEnter={() => setSelectedIndex(index)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    backgroundColor: index === selectedIndex ? 'var(--surface-2)' : 'transparent',
                    transition: 'background-color 0.1s',
                  }}
                >
                  <div style={{
                    width: 28, height: 28,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--surface-3)',
                    color: 'var(--text-secondary)',
                    flexShrink: 0,
                  }}>
                    {cmd.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: 500,
                      color: 'var(--text-primary)',
                    }}>
                      {cmd.label}
                    </div>
                    <div style={{
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--text-tertiary)',
                    }}>
                      {cmd.description}
                    </div>
                  </div>
                </motion.div>
              ))}
              {filteredCommands.length === 0 && (
                <div style={{
                  padding: 'var(--space-6)',
                  textAlign: 'center',
                  color: 'var(--text-tertiary)',
                  fontSize: 'var(--font-size-sm)',
                }}>
                  No commands found
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
