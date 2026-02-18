import { useState, useRef, useEffect } from 'react';
import { useStore } from '../../store';
import { motion } from 'framer-motion';
import { ArrowUp, Paperclip, Square } from 'lucide-react';
import AttachmentPreview from './AttachmentPreview';

interface Attachment { id: string; file: File; preview?: string; }

export default function TaskInput() {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const startPipeline = useStore((s) => s.startPipeline);
  const sendMessage = useStore((s) => s.sendMessage);
  const isRunning = useStore((s) => s.isRunning);

  const handleSubmit = () => {
    if (!input.trim() || isRunning) return;
    startPipeline(input, 'auto');
    sendMessage({ type: 'start_pipeline', task: input, mode: 'auto' });
    setInput('');
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleStop = () => {
    sendMessage({ type: 'cancel_pipeline' });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleAttach = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newAttachments = files.map(file => {
      const att: Attachment = { id: crypto.randomUUID(), file };
      if (file.type.startsWith('image/')) {
        att.preview = URL.createObjectURL(file);
      }
      return att;
    });
    setAttachments(prev => [...prev, ...newAttachments]);
    e.target.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => {
      const att = prev.find(a => a.id === id);
      if (att?.preview) URL.revokeObjectURL(att.preview);
      return prev.filter(a => a.id !== id);
    });
  };

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, [input]);

  const canSend = input.trim() && !isRunning;

  return (
    <div style={{
      borderTop: '1px solid var(--border)',
      backgroundColor: 'var(--surface)',
      padding: 'var(--space-3) var(--space-4)',
      flexShrink: 0,
    }}>
      <div
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const files = Array.from(e.dataTransfer.files);
          const newAttachments = files.map(file => {
            const att: Attachment = { id: crypto.randomUUID(), file };
            if (file.type.startsWith('image/')) att.preview = URL.createObjectURL(file);
            return att;
          });
          setAttachments(prev => [...prev, ...newAttachments]);
        }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-2)',
          transition: 'border-color 0.2s',
        }}
      >
        {/* Attachment previews */}
        <AttachmentPreview attachments={attachments} onRemove={removeAttachment} />

        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 'var(--space-2)',
        }}>
          {/* Attach button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleAttach}
            style={{
              width: 32, height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--radius-pill)',
              backgroundColor: 'var(--surface-3)',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              flexShrink: 0,
              border: 'none',
            }}
          >
            <Paperclip size={14} />
          </motion.button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.ts,.tsx,.js,.jsx,.py,.json,.md,.txt,.css,.html"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What should we build?"
            disabled={isRunning}
            rows={1}
            style={{
              flex: 1,
              resize: 'none',
              border: 'none',
              outline: 'none',
              backgroundColor: 'transparent',
              color: 'var(--text-primary)',
              fontSize: 'var(--font-size-md)',
              lineHeight: 'var(--line-height-normal)',
              padding: '6px 4px',
              minHeight: 32,
              maxHeight: 120,
              fontFamily: 'var(--font-sans)',
            }}
          />

          {/* Send / Stop button */}
          <motion.button
            whileHover={canSend || isRunning ? { scale: 1.05 } : {}}
            whileTap={canSend || isRunning ? { scale: 0.9 } : {}}
            onClick={isRunning ? handleStop : handleSubmit}
            disabled={!canSend && !isRunning}
            style={{
              width: 32, height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--radius-pill)',
              border: 'none',
              cursor: (canSend || isRunning) ? 'pointer' : 'not-allowed',
              background: isRunning ? 'var(--error)' : canSend ? 'var(--gradient-fire)' : 'var(--surface-3)',
              color: (canSend || isRunning) ? '#000' : 'var(--text-muted)',
              transition: 'var(--transition-fast)',
              flexShrink: 0,
            }}
          >
            {isRunning ? (
              <Square size={12} fill="currentColor" />
            ) : (
              <ArrowUp size={16} strokeWidth={2.5} />
            )}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
