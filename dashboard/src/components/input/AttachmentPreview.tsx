import { motion, AnimatePresence } from 'framer-motion';
import { X, FileCode } from 'lucide-react';

interface Attachment {
  id: string;
  file: File;
  preview?: string;
}

interface AttachmentPreviewProps {
  attachments: Attachment[];
  onRemove: (id: string) => void;
}

export default function AttachmentPreview({ attachments, onRemove }: AttachmentPreviewProps) {
  if (attachments.length === 0) return null;

  return (
    <div style={{
      display: 'flex',
      gap: 'var(--space-2)',
      padding: '8px 0',
      overflowX: 'auto',
    }}>
      <AnimatePresence>
        {attachments.map((att) => {
          const isImage = att.file.type.startsWith('image/');
          return (
            <motion.div
              key={att.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              style={{
                position: 'relative',
                flexShrink: 0,
              }}
            >
              <div style={{
                width: isImage ? 64 : 'auto',
                height: 48,
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: isImage ? 0 : '0 10px',
                backgroundColor: 'var(--surface-2)',
              }}>
                {isImage && att.preview ? (
                  <img src={att.preview} alt={att.file.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <>
                    <FileCode size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                    <span style={{
                      fontSize: 10,
                      color: 'var(--text-secondary)',
                      maxWidth: 80,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {att.file.name}
                    </span>
                  </>
                )}
              </div>
              <button
                onClick={() => onRemove(att.id)}
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  backgroundColor: 'var(--surface-3)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                }}
              >
                <X size={10} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
