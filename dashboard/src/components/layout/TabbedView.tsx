import { useState } from 'react';
import { useStore } from '../../store';
import MessageFeed from '../messages/MessageFeed';
import AgentActivity from '../agents/AgentActivity';
import ToolCallCard from '../agents/ToolCallCard';
import FileTree from '../code/FileTree';
import CodeBlock from '../code/CodeBlock';
import DiffViewer from '../code/DiffViewer';
import Badge from '../common/Badge';

type Tab = 'messages' | 'code' | 'activity';

export default function TabbedView() {
  const [activeTab, setActiveTab] = useState<Tab>('messages');
  const toolCalls = useStore((s) => s.toolCalls);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  // Extract code-related data from tool calls
  const codeToolCalls = toolCalls.filter(
    (tc) => tc.result && !tc.isError && (
      tc.tool.includes('read') || tc.tool.includes('write') ||
      tc.tool.includes('edit') || tc.tool.includes('diff') ||
      tc.tool.includes('file')
    )
  );

  const changedFiles = codeToolCalls
    .map((tc) => {
      const file = (tc.args.path || tc.args.file || tc.args.filePath) as string | undefined;
      return file;
    })
    .filter((f): f is string => !!f);

  const uniqueFiles = [...new Set(changedFiles)];

  // Get code content for selected file
  const selectedToolCall = selectedFile
    ? codeToolCalls.find((tc) => {
        const file = (tc.args.path || tc.args.file || tc.args.filePath) as string | undefined;
        return file === selectedFile;
      })
    : null;

  const selectedContent = selectedToolCall?.result || '';
  const isDiff = selectedContent.startsWith('---') || selectedContent.startsWith('diff ') || selectedContent.includes('\n@@');

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'messages', label: 'Messages' },
    { id: 'code', label: 'Code', count: uniqueFiles.length },
    { id: 'activity', label: 'Activity', count: toolCalls.length },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tab Bar */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border)',
        backgroundColor: 'var(--surface)',
        padding: '0 12px',
        gap: '4px',
        flexShrink: 0,
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 16px',
              fontSize: '13px',
              fontWeight: 500,
              color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <Badge variant={activeTab === tab.id ? 'warning' : 'default'}>
                {tab.count}
              </Badge>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab === 'messages' && <MessageFeed />}

        {activeTab === 'code' && (
          <div style={{ display: 'flex', height: '100%' }}>
            {/* File tree sidebar */}
            <div style={{
              width: '200px',
              borderRight: '1px solid var(--border)',
              overflow: 'auto',
              flexShrink: 0,
            }}>
              {uniqueFiles.length > 0 ? (
                <FileTree
                  files={uniqueFiles}
                  onFileClick={(file) => setSelectedFile(file)}
                />
              ) : (
                <div style={{
                  padding: '24px 16px',
                  color: 'var(--text-tertiary)',
                  fontSize: '13px',
                  textAlign: 'center',
                }}>
                  No files changed yet
                </div>
              )}
            </div>

            {/* Code content */}
            <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
              {selectedFile && selectedContent ? (
                isDiff ? (
                  <DiffViewer diff={selectedContent} />
                ) : (
                  <CodeBlock code={selectedContent} />
                )
              ) : (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: 'var(--text-tertiary)',
                  fontSize: '14px',
                }}>
                  {uniqueFiles.length > 0
                    ? 'Select a file to view'
                    : 'Code changes will appear here'}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <div style={{ height: '100%', overflow: 'auto', padding: '12px' }}>
            <AgentActivity />
            {toolCalls.length > 0 ? (
              <div style={{ marginTop: '12px' }}>
                <div style={{
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  letterSpacing: '0.5px',
                  marginBottom: '8px',
                  padding: '0 4px',
                }}>
                  Tool Calls ({toolCalls.length})
                </div>
                {[...toolCalls].reverse().map((tc, i) => (
                  <ToolCallCard key={`${tc.tool}-${tc.timestamp}-${i}`} toolCall={tc} />
                ))}
              </div>
            ) : (
              <div style={{
                padding: '24px',
                color: 'var(--text-tertiary)',
                fontSize: '13px',
                textAlign: 'center',
              }}>
                No tool calls yet
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
