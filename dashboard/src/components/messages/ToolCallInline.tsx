import { motion } from 'framer-motion';
import { Loader, Wrench } from 'lucide-react';
import { ToolCallData } from '../../store/messages-slice';
import FileEditCard from './tools/FileEditCard';
import TerminalCard from './tools/TerminalCard';
import TestResultCard from './tools/TestResultCard';
import SearchResultCard from './tools/SearchResultCard';
import GitCard from './tools/GitCard';
import ToolCallCard from '../agents/ToolCallCard';

interface ToolCallInlineProps {
  toolCall: ToolCallData;
}

/** Human-readable tool action label */
function getRunningLabel(tool: string, args: Record<string, unknown>): string {
  const t = tool.toLowerCase();
  const file = args.path || args.file || args.filePath;
  const name = file ? String(file).split('/').pop() : '';

  if (t.includes('read') && name) return `Reading ${name}`;
  if (t.includes('write') && name) return `Writing ${name}`;
  if (t.includes('edit') && name) return `Editing ${name}`;
  if (t.includes('search')) return `Searching for "${String(args.query || args.pattern || '').slice(0, 30)}"`;
  if (t.includes('glob')) return `Finding files matching ${String(args.pattern || '').slice(0, 30)}`;
  if (t.includes('shell') || t.includes('exec')) return `Running: ${String(args.command || args.cmd || '').slice(0, 40)}`;
  if (t.includes('test')) return 'Running tests';
  if (t.includes('git')) return `Git ${tool.replace(/git_?/i, '')}`;
  if (t.includes('analyze')) return `Analyzing ${name || 'code'}`;
  if (t.includes('memory')) return `Accessing memory`;
  if (t.includes('web') && t.includes('search')) return `Searching the web`;
  if (t.includes('web') && t.includes('fetch')) return `Fetching ${String(args.url || '').slice(0, 40)}`;
  return tool.replace(/_/g, ' ');
}

export default function ToolCallInline({ toolCall }: ToolCallInlineProps) {
  const { tool, args, result, isError } = toolCall;

  // Still running — show a compact "in-progress" card
  if (!result && result !== '') {
    return (
      <motion.div
        initial={{ opacity: 0, x: -4 }}
        animate={{ opacity: 1, x: 0 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          backgroundColor: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          marginTop: 'var(--space-1)',
          marginBottom: 'var(--space-1)',
        }}
      >
        <Loader size={12} style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite', flexShrink: 0 }} />
        <span style={{
          fontSize: 'var(--font-size-sm)',
          color: 'var(--text-secondary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {getRunningLabel(tool, args)}
        </span>
        <div style={{ display: 'flex', gap: 2, marginLeft: 'auto', flexShrink: 0 }}>
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
              style={{ width: 3, height: 3, borderRadius: '50%', backgroundColor: 'var(--accent)' }}
            />
          ))}
        </div>
      </motion.div>
    );
  }

  // Route to specialized card based on tool name
  const toolLower = tool.toLowerCase();

  // File edit/write tools
  if (toolLower.includes('write') || toolLower.includes('edit')) {
    const filename = (args.path || args.file || args.filePath || 'unknown') as string;
    return <FileEditCard filename={filename} content={result} isError={isError} />;
  }

  // Shell/exec tools
  if (toolLower.includes('shell') || toolLower.includes('exec') || toolLower.includes('command')) {
    const command = (args.command || args.cmd || '') as string;
    const exitMatch = result.match(/exit[_ ]?code[:\s]*(\d+)/i);
    const exitCode = exitMatch ? parseInt(exitMatch[1]) : (isError ? 1 : 0);
    return <TerminalCard command={command} output={result} exitCode={exitCode} isError={isError} />;
  }

  // Test tools
  if (toolLower.includes('test')) {
    return <TestResultCard output={result} isError={isError} />;
  }

  // Search tools
  if (toolLower.includes('search') || toolLower.includes('find') || toolLower.includes('glob')) {
    const query = (args.query || args.pattern || args.path || '') as string;
    return <SearchResultCard query={query} output={result} isError={isError} />;
  }

  // Git tools
  if (toolLower.includes('git')) {
    return <GitCard tool={tool} output={result} args={args} isError={isError} />;
  }

  // Fallback to generic ToolCallCard (now shows human-readable output)
  return <ToolCallCard toolCall={{ tool, args, timestamp: toolCall.startedAt, result, isError }} />;
}
