import { useEffect, useRef } from 'react';
import { useStore } from '../../store';
import { AnimatePresence } from 'framer-motion';
import MessageBubble from './MessageBubble';
import EmptyState from '../common/EmptyState';
import ThinkingIndicator from '../common/ThinkingIndicator';
import StageProgressBanner from './StageProgressBanner';

export default function MessageFeed() {
  const messages = useStore((s) => s.messages);
  const activeAgent = useStore((s) => s.activeAgent);
  const activeTool = useStore((s) => s.activeTool);
  const thinkingStartedAt = useStore((s) => s.thinkingStartedAt);
  const isRunning = useStore((s) => s.isRunning);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeAgent]);

  if (messages.length === 0 && !activeAgent && !isRunning) {
    return <EmptyState />;
  }

  return (
    <div className="scroll-area" style={{
      flex: 1,
      padding: 'var(--space-4) var(--space-6)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-1)',
    }}>
      {/* Pipeline stage progress — always at top when running */}
      <StageProgressBanner />

      <AnimatePresence initial={false}>
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
      </AnimatePresence>

      {/* Active thinking indicator */}
      {activeAgent && (
        <ThinkingIndicator
          startedAt={thinkingStartedAt}
          label={activeTool ? `Using ${activeTool}` : `${activeAgent} thinking`}
        />
      )}

      <div ref={bottomRef} />
    </div>
  );
}
