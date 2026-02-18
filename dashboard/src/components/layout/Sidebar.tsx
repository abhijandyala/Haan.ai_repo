import { useStore } from '../../store';
import { motion } from 'framer-motion';
import { Plus, Flame, Settings, Zap, GitBranch, Clock } from 'lucide-react';
import Spinner from '../common/Spinner';
import Badge from '../common/Badge';
import Tooltip from '../common/Tooltip';
import IconButton from '../common/IconButton';

export default function Sidebar() {
  const threads = useStore((s) => s.threads);
  const activeThreadId = useStore((s) => s.activeThreadId);
  const setActiveThread = useStore((s) => s.setActiveThread);
  const addThread = useStore((s) => s.addThread);
  const isRunning = useStore((s) => s.isRunning);
  const totalCost = useStore((s) => s.totalCost);
  const inputTokens = useStore((s) => s.totalInputTokens);
  const outputTokens = useStore((s) => s.totalOutputTokens);
  const stages = useStore((s) => s.stages);

  const completedStages = stages.filter((s) => s.status === 'complete').length;
  const totalStages = stages.length;

  const handleNewThread = () => {
    addThread({
      title: 'New thread',
      status: 'idle',
      messageCount: 0,
      filesChanged: 0,
      linesAdded: 0,
      linesRemoved: 0,
    });
  };

  const formatTimeAgo = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  const statusColors: Record<string, string> = {
    running: 'var(--accent)',
    completed: 'var(--success)',
    failed: 'var(--error)',
    idle: 'var(--text-muted)',
  };

  return (
    <aside style={{
      width: 'var(--sidebar-width)',
      backgroundColor: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      height: '100%',
    }}>
      {/* New thread button */}
      <div style={{ padding: 'var(--space-3)' }}>
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleNewThread}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-2)',
            padding: '10px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            backgroundColor: 'var(--surface-2)',
            color: 'var(--text-primary)',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'var(--transition-fast)',
          }}
        >
          <Plus size={14} />
          New thread
        </motion.button>
      </div>

      {/* Pipeline status */}
      {totalStages > 0 && (
        <div style={{
          margin: '0 var(--space-3) var(--space-3)',
          padding: 'var(--space-3)',
          backgroundColor: 'var(--surface-2)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 'var(--space-2)',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
            }}>
              {isRunning && <Spinner size="sm" />}
              <span style={{
                fontSize: 'var(--font-size-xs)',
                color: 'var(--text-secondary)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                Pipeline
              </span>
            </div>
            <span style={{
              fontSize: 'var(--font-size-sm)',
              fontWeight: 600,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
            }}>
              {completedStages}/{totalStages}
            </span>
          </div>
          <div style={{
            height: 3,
            backgroundColor: 'var(--surface-3)',
            borderRadius: 2,
            overflow: 'hidden',
          }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${totalStages > 0 ? (completedStages / totalStages) * 100 : 0}%` }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              style={{
                height: '100%',
                background: 'var(--gradient-fire)',
              }}
            />
          </div>
        </div>
      )}

      {/* Thread list */}
      <div className="scroll-area" style={{ flex: 1, padding: '0 var(--space-2)' }}>
        {threads.length > 0 ? (
          threads.map((thread) => (
            <motion.div
              key={thread.id}
              whileHover={{ backgroundColor: 'var(--surface-hover)' }}
              onClick={() => setActiveThread(thread.id)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 'var(--space-2)',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                transition: 'var(--transition-fast)',
                backgroundColor: thread.id === activeThreadId ? 'var(--accent-bg)' : 'transparent',
                borderLeft: thread.id === activeThreadId
                  ? '2px solid var(--accent)'
                  : '2px solid transparent',
                marginBottom: 1,
              }}
            >
              {/* Status dot */}
              <div style={{
                width: 7, height: 7,
                borderRadius: '50%',
                backgroundColor: statusColors[thread.status] || 'var(--text-muted)',
                marginTop: 5,
                flexShrink: 0,
                animation: thread.status === 'running' ? 'pulse 2s ease-in-out infinite' : 'none',
              }} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 500,
                  color: thread.id === activeThreadId ? 'var(--text-primary)' : 'var(--text-secondary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {thread.title}
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  marginTop: 2,
                }}>
                  {thread.filesChanged > 0 && (
                    <span style={{
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--text-tertiary)',
                      fontFamily: 'var(--font-mono)',
                    }}>
                      <span style={{ color: 'var(--success)' }}>+{thread.linesAdded}</span>
                      {' '}
                      <span style={{ color: 'var(--error)' }}>-{thread.linesRemoved}</span>
                    </span>
                  )}
                  <span style={{
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--text-muted)',
                  }}>
                    {formatTimeAgo(thread.updatedAt)}
                  </span>
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          <div style={{
            padding: 'var(--space-6) var(--space-4)',
            textAlign: 'center',
          }}>
            <Zap size={20} style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }} />
            <p style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--text-tertiary)',
              lineHeight: 'var(--line-height-normal)',
            }}>
              Start a task to create your first thread
            </p>
          </div>
        )}
      </div>

      {/* Footer: cost display */}
      <div style={{
        padding: 'var(--space-3)',
        borderTop: '1px solid var(--border)',
      }}>
        <div style={{
          padding: 'var(--space-3)',
          backgroundColor: 'var(--surface-2)',
          borderRadius: 'var(--radius-md)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 'var(--space-2)',
          }}>
            <span style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--text-tertiary)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              Usage
            </span>
            <span style={{
              fontSize: 'var(--font-size-lg)',
              fontWeight: 700,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
            }}>
              ${totalCost.toFixed(4)}
            </span>
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
          }}>
            <span>{inputTokens.toLocaleString()} in</span>
            <span>{outputTokens.toLocaleString()} out</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
