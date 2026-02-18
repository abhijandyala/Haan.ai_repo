import React from 'react';
import { Box, Text } from 'ink';
import { theme, agentMeta } from '../context/theme.js';
import type { MessageData } from '../context/app-context.js';
import { CodeBlock } from './code-block.js';
import { Spinner } from './spinner.js';

interface MessageBubbleProps {
  message: MessageData;
}

interface ContentPart {
  type: 'text' | 'code' | 'structured';
  content: string;
  language?: string;
  data?: Record<string, unknown>;
}

/**
 * Try to detect if a JSON code block is a structured agent output
 * (builder summary, test results, debug report, etc.) and parse it.
 */
function tryParseStructured(json: string): Record<string, unknown> | null {
  try {
    const obj = JSON.parse(json);
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      // Must have at least one known agent output key
      const keys = Object.keys(obj);
      const knownKeys = ['filesCreated', 'filesModified', 'buildSuccess', 'summary',
        'testResults', 'testsWritten', 'fixes', 'unfixed', 'confidence',
        'filesDeleted', 'notes', 'coverageNotes'];
      if (keys.some(k => knownKeys.includes(k))) {
        return obj;
      }
    }
  } catch { /* not valid JSON */ }
  return null;
}

function parseContent(content: string): ContentPart[] {
  const parts: ContentPart[] = [];
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index).trim();
      if (text) parts.push({ type: 'text', content: text });
    }

    const lang = match[1] || 'text';
    const code = match[2].trim();

    // Try to parse JSON blocks as structured data for nicer rendering
    if (lang === 'json' || lang === '') {
      const structured = tryParseStructured(code);
      if (structured) {
        parts.push({ type: 'structured', content: code, data: structured });
        lastIndex = match.index + match[0].length;
        continue;
      }
    }

    parts.push({ type: 'code', content: code, language: lang });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    const text = content.slice(lastIndex).trim();
    if (text) parts.push({ type: 'text', content: text });
  }

  if (parts.length === 0) {
    parts.push({ type: 'text', content });
  }

  return parts;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * Render inline markdown-like formatting in text.
 * Supports: **bold**, *italic*, `code`, file paths, and bullet lists.
 */
function RichText({ text, baseColor }: { text: string; baseColor: string }) {
  // Split into lines to handle lists
  const lines = text.split('\n');

  return (
    <Box flexDirection="column">
      {lines.map((line, lineIdx) => {
        const trimmed = line.trim();

        // Bullet list items
        if (/^[-*]\s/.test(trimmed)) {
          return (
            <Box key={lineIdx} paddingLeft={1}>
              <Text color={theme.ui.info}>{'\u2022'} </Text>
              <InlineFormatted text={trimmed.slice(2)} baseColor={baseColor} />
            </Box>
          );
        }

        // Numbered list items
        if (/^\d+[.)]\s/.test(trimmed)) {
          const numMatch = trimmed.match(/^(\d+[.)]\s)/);
          const num = numMatch ? numMatch[1] : '';
          return (
            <Box key={lineIdx} paddingLeft={1}>
              <Text color={theme.ui.info}>{num}</Text>
              <InlineFormatted text={trimmed.slice(num.length)} baseColor={baseColor} />
            </Box>
          );
        }

        // Empty line
        if (!trimmed) {
          return <Text key={lineIdx}> </Text>;
        }

        return <InlineFormatted key={lineIdx} text={line} baseColor={baseColor} />;
      })}
    </Box>
  );
}

/**
 * Render inline formatting: **bold**, `code`, file paths.
 */
function InlineFormatted({ text, baseColor }: { text: string; baseColor: string }) {
  const segments: React.ReactNode[] = [];
  // Match **bold**, `inline code`, and file-like paths
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let segIdx = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push(
        <Text key={segIdx++} color={baseColor}>{text.slice(lastIndex, match.index)}</Text>,
      );
    }

    const token = match[1];
    if (token.startsWith('**') && token.endsWith('**')) {
      segments.push(
        <Text key={segIdx++} color={baseColor} bold>{token.slice(2, -2)}</Text>,
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      segments.push(
        <Text key={segIdx++} color={theme.ui.warning} bold>{token.slice(1, -1)}</Text>,
      );
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push(
      <Text key={segIdx++} color={baseColor}>{text.slice(lastIndex)}</Text>,
    );
  }

  if (segments.length === 0) {
    return <Text color={baseColor}>{text}</Text>;
  }

  return <Text>{segments}</Text>;
}

/**
 * Render structured agent output (builder summary, test results, etc.)
 * as a clean, readable card instead of raw JSON.
 */
function StructuredOutput({ data }: { data: Record<string, unknown> }) {
  const rows: Array<{ icon: string; label: string; value: string; color: string }> = [];

  // Files created
  const created = Array.isArray(data.filesCreated) ? data.filesCreated as string[] : [];
  if (created.length > 0) {
    rows.push({ icon: '\u{2795}', label: 'Created', value: created.join(', '), color: theme.ui.success });
  }

  // Files modified
  const modified = Array.isArray(data.filesModified) ? data.filesModified as string[] : [];
  if (modified.length > 0) {
    rows.push({ icon: '\u{270F}\u{FE0F}', label: 'Modified', value: modified.join(', '), color: theme.ui.info });
  }

  // Files deleted
  const deleted = Array.isArray(data.filesDeleted) ? data.filesDeleted as string[] : [];
  if (deleted.length > 0) {
    rows.push({ icon: '\u{1F5D1}\u{FE0F}', label: 'Deleted', value: deleted.join(', '), color: theme.ui.error });
  }

  // Build success
  if (typeof data.buildSuccess === 'boolean') {
    rows.push({
      icon: data.buildSuccess ? '\u{2705}' : '\u{274C}',
      label: 'Build',
      value: data.buildSuccess ? 'Passed' : 'Failed',
      color: data.buildSuccess ? theme.ui.success : theme.ui.error,
    });
  }

  // Test results
  const testResults = data.testResults as Record<string, unknown> | undefined;
  if (testResults) {
    const passed = Number(testResults.passed ?? 0);
    const failed = Number(testResults.failed ?? 0);
    const total = Number(testResults.total ?? 0);
    const allPassed = failed === 0 && total > 0;
    rows.push({
      icon: allPassed ? '\u{2705}' : '\u{274C}',
      label: 'Tests',
      value: `${passed} passed, ${failed} failed (${total} total)`,
      color: allPassed ? theme.ui.success : theme.ui.error,
    });
  }

  // Tests written
  const testsWritten = Array.isArray(data.testsWritten) ? data.testsWritten as string[] : [];
  if (testsWritten.length > 0) {
    rows.push({ icon: '\u{1F9EA}', label: 'Tests Written', value: testsWritten.join(', '), color: theme.ui.info });
  }

  // Fixes (debugger)
  const fixes = Array.isArray(data.fixes) ? data.fixes as string[] : [];
  if (fixes.length > 0) {
    rows.push({ icon: '\u{1F527}', label: 'Fixes', value: `${fixes.length} applied`, color: theme.ui.success });
  }

  // Confidence
  if (typeof data.confidence === 'number') {
    const pct = Math.round(data.confidence * 100);
    rows.push({ icon: '\u{1F3AF}', label: 'Confidence', value: `${pct}%`, color: pct >= 80 ? theme.ui.success : theme.ui.warning });
  }

  // Summary
  const summary = data.summary as string | undefined;

  // Notes
  const notes = (data.notes || data.coverageNotes) as string | undefined;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.ui.dim} paddingX={1} marginY={0}>
      {rows.map((row, i) => (
        <Box key={i} gap={1}>
          <Text>{row.icon}</Text>
          <Text color={theme.ui.muted} bold>{row.label}:</Text>
          <Text color={row.color}>{row.value}</Text>
        </Box>
      ))}
      {summary && (
        <Box marginTop={rows.length > 0 ? 1 : 0}>
          <Text color={theme.ui.text} wrap="wrap">{summary}</Text>
        </Box>
      )}
      {notes && (
        <Box>
          <Text color={theme.ui.muted} italic wrap="wrap">{notes}</Text>
        </Box>
      )}
    </Box>
  );
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const { role, agent, content, timestamp, isStreaming } = message;

  let roleLabel: string;
  let roleColor: string;
  let roleIcon: string;
  let showBorder = false;

  const isReasoning = role === 'reasoning';

  if (role === 'user') {
    roleLabel = 'YOU';
    roleColor = theme.ui.primary;
    roleIcon = '\u{276F}';
    showBorder = true;
  } else if (isReasoning) {
    const meta = agent ? agentMeta(agent) : null;
    roleLabel = meta ? `${meta.label} THINKING` : 'THINKING';
    roleColor = theme.ui.dim;
    roleIcon = '\u{1F4AD}';
  } else if (role === 'system') {
    roleLabel = 'SYSTEM';
    roleColor = theme.ui.warning;
    roleIcon = '\u{2699}\u{FE0F}';
  } else if (role === 'tool') {
    roleLabel = 'TOOL';
    roleColor = theme.ui.info;
    roleIcon = '\u{1F527}';
  } else if (agent) {
    const meta = agentMeta(agent);
    roleLabel = meta.label;
    roleColor = meta.color;
    roleIcon = meta.icon;
  } else {
    roleLabel = 'HAAN';
    roleColor = theme.ui.secondary;
    roleIcon = '\u{2728}';
  }

  const parts = parseContent(content);

  // For reasoning blocks, use dimmed text color
  const contentColor = isReasoning ? theme.ui.muted : theme.ui.text;

  return (
    <Box flexDirection="column" paddingX={1} marginY={0}>
      <Box gap={1}>
        <Text color={roleColor} bold={!isReasoning} dimColor={isReasoning}>
          {roleIcon} {roleLabel}
        </Text>
        <Text color={theme.ui.dim}>{formatTime(timestamp)}</Text>
        {isStreaming && <Spinner color={roleColor} />}
      </Box>
      {isReasoning ? (
        <Box flexDirection="column" paddingLeft={2} marginTop={0}
          borderStyle="single" borderColor={theme.ui.dim} borderLeft borderTop={false} borderRight={false} borderBottom={false}>
          {parts.map((part, i) =>
            part.type === 'structured' && part.data ? (
              <StructuredOutput key={i} data={part.data} />
            ) : part.type === 'code' ? (
              <CodeBlock key={i} code={part.content} language={part.language} />
            ) : (
              <RichText key={i} text={part.content} baseColor={contentColor} />
            ),
          )}
        </Box>
      ) : (
        <Box flexDirection="column" paddingLeft={2} marginTop={0}>
          {parts.map((part, i) =>
            part.type === 'structured' && part.data ? (
              <StructuredOutput key={i} data={part.data} />
            ) : part.type === 'code' ? (
              <CodeBlock key={i} code={part.content} language={part.language} />
            ) : (
              <RichText key={i} text={part.content} baseColor={contentColor} />
            ),
          )}
        </Box>
      )}
    </Box>
  );
}
