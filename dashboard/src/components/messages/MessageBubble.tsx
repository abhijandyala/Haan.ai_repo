import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Message } from '../../store/messages-slice';
import AgentBadge from '../agents/AgentBadge';
import StreamingIndicator from './StreamingIndicator';
import ReasoningBlock from './ReasoningBlock';
import ToolCallInline from './ToolCallInline';
import PlanDisplay from './PlanDisplay';
import { User } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  // System messages
  if (message.role === 'system') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{
          textAlign: 'center',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--text-tertiary)',
          padding: 'var(--space-2) var(--space-4)',
        }}
      >
        {message.content}
      </motion.div>
    );
  }

  // Reasoning blocks
  if (message.role === 'reasoning') {
    return <ReasoningBlock content={message.content} />;
  }

  const isUser = message.role === 'user';

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
      style={{
        display: 'flex',
        gap: 'var(--space-3)',
        padding: 'var(--space-3) 0',
        alignItems: 'flex-start',
      }}
    >
      {/* Avatar */}
      <div style={{
        width: 28, height: 28,
        borderRadius: 'var(--radius-sm)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        marginTop: 2,
        ...(isUser
          ? { backgroundColor: 'var(--surface-3)', color: 'var(--text-secondary)' }
          : { background: 'var(--gradient-fire)', color: '#000' }),
      }}>
        {isUser ? (
          <User size={14} />
        ) : (
          <span style={{ fontSize: 13, fontWeight: 700 }}>H</span>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          marginBottom: 'var(--space-1)',
        }}>
          <span style={{
            fontSize: 'var(--font-size-sm)',
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}>
            {isUser ? 'You' : (message.agent || 'Haan')}
          </span>
          {message.agent && !isUser && (
            <AgentBadge agent={message.agent} />
          )}
          <span style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--text-muted)',
            marginLeft: 'auto',
          }}>
            {formatTime(message.timestamp)}
          </span>
        </div>

        {/* Message body */}
        <div className="markdown-body" style={{
          fontSize: 'var(--font-size-md)',
          lineHeight: 'var(--line-height-relaxed)',
          color: 'var(--text-primary)',
        }}>
          {(() => {
            // Check if content is a structured plan
            const isPlan = !isUser && (
              message.content.includes('- [ ]') ||
              message.content.includes('- [x]') ||
              (message.content.match(/^#{1,3}\s+/m) && message.content.split('\n').filter(l => l.match(/^\s*(\d+\.\s|[-*]\s)/)).length >= 3)
            );

            if (isPlan) {
              // Render plan card — strip the plan content from markdown to avoid duplication
              return <PlanDisplay content={message.content} />;
            }

            return (
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                {message.content}
              </ReactMarkdown>
            );
          })()}
          {message.isStreaming && <StreamingIndicator />}
          {message.toolCalls && message.toolCalls.length > 0 && (
            <div style={{ marginTop: 'var(--space-2)' }}>
              {message.toolCalls.map((tc) => (
                <ToolCallInline key={tc.id} toolCall={tc} />
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
