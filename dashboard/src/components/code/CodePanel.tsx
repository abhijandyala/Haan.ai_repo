import { useStore } from '../../store';
import { motion } from 'framer-motion';
import { GitBranch, FileCode, Copy, Check } from 'lucide-react';
import FileTree from './FileTree';
import DiffViewer from './DiffViewer';
import CodeBlock from './CodeBlock';
import Badge from '../common/Badge';

export default function CodePanel() {
  const toolCalls = useStore((s) => s.toolCalls);
  const selectedFile = useStore((s) => s.selectedFile);
  const setSelectedFile = useStore((s) => s.setSelectedFile);

  const codeToolCalls = toolCalls.filter(
    (tc) => tc.result && !tc.isError && (
      tc.tool.includes('read') || tc.tool.includes('write') ||
      tc.tool.includes('edit') || tc.tool.includes('diff') ||
      tc.tool.includes('file')
    )
  );

  const changedFiles = codeToolCalls
    .map((tc) => (tc.args.path || tc.args.file || tc.args.filePath) as string | undefined)
    .filter((f): f is string => !!f);

  const uniqueFiles = [...new Set(changedFiles)];

  const selectedToolCall = selectedFile
    ? codeToolCalls.find((tc) => {
        const file = (tc.args.path || tc.args.file || tc.args.filePath) as string | undefined;
        return file === selectedFile;
      })
    : null;

  const selectedContent = selectedToolCall?.result || '';
  const isDiff = selectedContent.startsWith('---') || selectedContent.startsWith('diff ') || selectedContent.includes('\n@@');

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: 'var(--surface)',
    }}>
      {/* Header */}
      <div style={{
        padding: 'var(--space-3) var(--space-4)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
        }}>
          <GitBranch size={14} style={{ color: 'var(--text-secondary)' }} />
          <span style={{
            fontSize: 'var(--font-size-sm)',
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}>
            Changes
          </span>
          {uniqueFiles.length > 0 && (
            <Badge variant="accent">{uniqueFiles.length}</Badge>
          )}
        </div>
      </div>

      {/* File list */}
      {uniqueFiles.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          {/* File tree area */}
          <div className="scroll-area" style={{
            borderBottom: selectedFile ? '1px solid var(--border)' : 'none',
            maxHeight: selectedFile ? '40%' : '100%',
            flexShrink: 0,
          }}>
            <FileTree
              files={uniqueFiles}
              onFileClick={(file) => setSelectedFile(file === selectedFile ? null : file)}
            />
          </div>

          {/* Diff / code view */}
          {selectedFile && selectedContent && (
            <div className="scroll-area" style={{ flex: 1 }}>
              <div style={{ padding: 'var(--space-3)' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  marginBottom: 'var(--space-3)',
                }}>
                  <FileCode size={13} style={{ color: 'var(--text-secondary)' }} />
                  <span style={{
                    fontSize: 'var(--font-size-xs)',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-secondary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {selectedFile.split('/').pop()}
                  </span>
                </div>
                {isDiff ? (
                  <DiffViewer diff={selectedContent} />
                ) : (
                  <CodeBlock code={selectedContent} />
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 'var(--space-2)',
          color: 'var(--text-muted)',
        }}>
          <FileCode size={24} />
          <span style={{ fontSize: 'var(--font-size-sm)' }}>
            Code changes appear here
          </span>
        </div>
      )}
    </div>
  );
}
