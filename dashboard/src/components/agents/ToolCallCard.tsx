import { useState } from 'react';
import { motion } from 'framer-motion';
import { ToolCall } from '../../store/agents-slice';
import {
  ChevronRight, ChevronDown, CheckCircle, XCircle, Wrench,
  FileText, Eye, Loader,
} from 'lucide-react';

interface ToolCallCardProps {
  toolCall: ToolCall;
}

/** Format a tool name into a human-readable label */
function formatToolName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Summarize tool args into a short human-readable string */
function summarizeArgs(tool: string, args: Record<string, unknown>): string {
  const toolLower = tool.toLowerCase();

  // File operations: show the file path
  if (args.path || args.file || args.filePath) {
    const p = String(args.path || args.file || args.filePath);
    const name = p.split('/').pop() || p;
    if (toolLower.includes('read')) return `Reading ${name}`;
    if (toolLower.includes('write')) return `Writing ${name}`;
    if (toolLower.includes('edit')) return `Editing ${name}`;
    if (toolLower.includes('delete')) return `Deleting ${name}`;
    if (toolLower.includes('list')) return `Listing ${name}`;
    return name;
  }

  // Search: show query
  if (args.query || args.pattern) {
    return `"${String(args.query || args.pattern).slice(0, 50)}"`;
  }

  // Shell: show command
  if (args.command || args.cmd) {
    const cmd = String(args.command || args.cmd);
    return cmd.length > 60 ? cmd.slice(0, 60) + '...' : cmd;
  }

  // Git: show message or ref
  if (args.message) return String(args.message).slice(0, 60);
  if (args.branch) return `branch: ${args.branch}`;

  // Memory
  if (args.key) return `key: ${String(args.key)}`;

  // URL
  if (args.url) return String(args.url).slice(0, 60);

  return '';
}

/** Format result text for display (truncate, clean up) */
function formatResult(result: string): string {
  // Try to parse JSON and show a summary instead
  try {
    const parsed = JSON.parse(result);
    if (Array.isArray(parsed)) {
      return `[${parsed.length} items]`;
    }
    if (typeof parsed === 'object' && parsed !== null) {
      const keys = Object.keys(parsed);
      if (keys.length <= 4) {
        return keys.map(k => `${k}: ${String(parsed[k]).slice(0, 40)}`).join('\n');
      }
      return keys.map(k => `${k}: ${String(parsed[k]).slice(0, 30)}`).slice(0, 5).join('\n') + `\n... (${keys.length} fields)`;
    }
  } catch {
    // Not JSON, just show as text
  }

  // If result is very long, truncate
  if (result.length > 800) {
    return result.slice(0, 800) + `\n\n... (${result.length} chars total)`;
  }
  return result;
}

export default function ToolCallCard({ toolCall }: ToolCallCardProps) {
  const [showDetails, setShowDetails] = useState(false);

  const hasResult = toolCall.result !== undefined && toolCall.result !== null;
  const isError = toolCall.isError;
  const isRunning = !hasResult;
  const summary = summarizeArgs(toolCall.tool, toolCall.args);

  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      style={{
        backgroundColor: 'var(--surface-2)',
        border: `1px solid ${isError ? 'rgba(248,81,73,0.3)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-md)',
        marginBottom: 'var(--space-2)',
        marginTop: 'var(--space-1)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          padding: '8px 12px',
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {isRunning ? (
          <Loader size={13} style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite', flexShrink: 0 }} />
        ) : (
          <Wrench size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
        )}
        <span style={{
          fontSize: 'var(--font-size-sm)',
          fontWeight: 600,
          color: 'var(--text-primary)',
        }}>
          {formatToolName(toolCall.tool)}
        </span>
        {summary && (
          <span style={{
            fontSize: 11,
            color: 'var(--text-tertiary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            fontFamily: summary.startsWith('"') ? 'inherit' : 'var(--font-mono)',
          }}>
            {summary}
          </span>
        )}
        {!summary && <span style={{ flex: 1 }} />}
        {hasResult && (
          isError
            ? <XCircle size={13} style={{ color: 'var(--error)', flexShrink: 0 }} />
            : <CheckCircle size={13} style={{ color: 'var(--success)', flexShrink: 0 }} />
        )}
        {hasResult && (
          showDetails
            ? <ChevronDown size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            : <ChevronRight size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        )}
      </button>

      {/* Expanded details */}
      {showDetails && hasResult && (
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '8px 12px',
        }}>
          {/* Result */}
          <pre style={{
            margin: 0,
            padding: 8,
            backgroundColor: 'var(--bg)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: isError ? 'var(--error)' : 'var(--text-secondary)',
            overflow: 'auto',
            maxHeight: 250,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            lineHeight: 1.5,
          }}>
            {formatResult(toolCall.result || '')}
          </pre>
        </div>
      )}
    </motion.div>
  );
}
