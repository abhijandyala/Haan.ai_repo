import fs from 'fs';
import path from 'path';
import { CommandHandler } from './index.js';
import { haanSubDir } from '../../utils/path-utils.js';

export const logsCommand: CommandHandler = {
  name: 'logs',
  description: 'View session logs. Shows the most recent log entries with optional filtering.',
  usage: '/logs [lines] [--errors] [--level <level>] [--stage <stage>] [--file <filename>]',
  async execute(args, context) {
    const logDir = haanSubDir('logs');
    const parts = args.trim().split(/\s+/).filter(Boolean);

    // Parse flags
    let lineCount = 50;
    let filterLevel: string | null = null;
    let filterStage: string | null = null;
    let specificFile: string | null = null;
    let errorsOnly = false;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part === '--errors' || part === '-e') {
        errorsOnly = true;
      } else if ((part === '--level' || part === '-l') && parts[i + 1]) {
        filterLevel = parts[++i];
      } else if ((part === '--stage' || part === '-s') && parts[i + 1]) {
        filterStage = parts[++i];
      } else if ((part === '--file' || part === '-f') && parts[i + 1]) {
        specificFile = parts[++i];
      } else if (part === '--list') {
        // List all log files
        return listLogFiles(logDir, context);
      } else if (part === '--help' || part === '-h') {
        return showHelp(context);
      } else if (/^\d+$/.test(part)) {
        lineCount = parseInt(part, 10);
      }
    }

    if (errorsOnly) {
      filterLevel = 'error';
    }

    // Find log file
    let logFilePath: string;
    if (specificFile) {
      logFilePath = path.join(logDir, specificFile);
      if (!fs.existsSync(logFilePath)) {
        context.addMessage('system', `Log file not found: ${specificFile}\nUse /logs --list to see available log files.`);
        return;
      }
    } else {
      // Find most recent log file
      const logFiles = getLogFiles(logDir);
      if (logFiles.length === 0) {
        context.addMessage('system', 'No log files found. Logs are created when you run a pipeline.');
        return;
      }
      logFilePath = logFiles[0].path;
    }

    // Read and parse log entries
    try {
      const content = fs.readFileSync(logFilePath, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);

      let entries: LogEntry[] = [];
      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as LogEntry;
          entries.push(entry);
        } catch {
          // Skip malformed lines
        }
      }

      // Apply filters
      if (filterLevel) {
        const level = filterLevel.toLowerCase();
        entries = entries.filter(e => e.level === level);
      }

      if (filterStage) {
        const stage = filterStage.toLowerCase();
        entries = entries.filter(e =>
          e.component.toLowerCase().includes(stage) ||
          e.message.toLowerCase().includes(stage)
        );
      }

      // Take last N entries
      const selected = entries.slice(-lineCount);

      if (selected.length === 0) {
        const filterDesc = filterLevel ? ` with level=${filterLevel}` : '';
        context.addMessage('system', `No log entries found${filterDesc}. Total entries in file: ${entries.length}`);
        return;
      }

      // Format output
      const formatted = formatLogEntries(selected);
      const fileName = path.basename(logFilePath);
      const header = `=== Logs: ${fileName} (${selected.length}/${entries.length} entries) ===`;

      // Add summary of errors/warnings if showing all levels
      if (!filterLevel) {
        const errorCount = entries.filter(e => e.level === 'error').length;
        const warnCount = entries.filter(e => e.level === 'warn').length;
        const summary = errorCount > 0 || warnCount > 0
          ? `\n--- Summary: ${errorCount} errors, ${warnCount} warnings ---`
          : '';
        context.addMessage('system', `${header}${summary}\n\n${formatted}`);
      } else {
        context.addMessage('system', `${header}\n\n${formatted}`);
      }
    } catch (err) {
      context.addMessage('system', `Failed to read logs: ${(err as Error).message}`);
    }
  },
};

interface LogEntry {
  ts: string;
  level: string;
  component: string;
  message: string;
  data?: unknown;
}

function getLogFiles(logDir: string): Array<{ name: string; path: string; mtime: number }> {
  try {
    const files = fs.readdirSync(logDir)
      .filter(f => f.startsWith('session-') && f.endsWith('.jsonl'))
      .map(name => {
        const filePath = path.join(logDir, name);
        const stat = fs.statSync(filePath);
        return { name, path: filePath, mtime: stat.mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);
    return files;
  } catch {
    return [];
  }
}

function listLogFiles(logDir: string, context: { addMessage: (role: string, content: string) => void }) {
  const files = getLogFiles(logDir);
  if (files.length === 0) {
    context.addMessage('system', 'No log files found.');
    return;
  }

  const lines = ['=== Log Files ===', ''];
  for (const file of files.slice(0, 20)) {
    const date = new Date(file.mtime).toLocaleString();
    const stat = fs.statSync(file.path);
    const sizeKB = (stat.size / 1024).toFixed(1);
    lines.push(`  ${file.name}  (${sizeKB}KB, ${date})`);
  }
  if (files.length > 20) {
    lines.push(`  ... and ${files.length - 20} more`);
  }
  lines.push('');
  lines.push('Use /logs --file <filename> to view a specific log file.');

  context.addMessage('system', lines.join('\n'));
}

function showHelp(context: { addMessage: (role: string, content: string) => void }) {
  context.addMessage('system', [
    '=== /logs Help ===',
    '',
    'Usage: /logs [lines] [options]',
    '',
    'Options:',
    '  [number]           Number of entries to show (default: 50)',
    '  --errors, -e       Show only error entries',
    '  --level, -l <lvl>  Filter by level (debug, info, warn, error)',
    '  --stage, -s <name> Filter by pipeline stage name',
    '  --file, -f <name>  Read a specific log file',
    '  --list             List all log files',
    '  --help, -h         Show this help',
    '',
    'Examples:',
    '  /logs              Show last 50 entries from current session',
    '  /logs 100          Show last 100 entries',
    '  /logs --errors     Show only error entries',
    '  /logs -l warn      Show warnings and errors',
    '  /logs -s planning  Show entries related to planning stage',
    '  /logs --list       List all available log files',
  ].join('\n'));
}

function formatLogEntries(entries: LogEntry[]): string {
  return entries.map(entry => {
    const time = entry.ts.split('T')[1]?.replace('Z', '') || entry.ts;
    const levelIcon = getLevelIcon(entry.level);
    const base = `${time} ${levelIcon} [${entry.component}] ${entry.message}`;

    if (entry.data && entry.level === 'error') {
      // Show error data for debugging
      const dataStr = typeof entry.data === 'string'
        ? entry.data
        : JSON.stringify(entry.data, null, 2);
      const truncated = dataStr.length > 500 ? dataStr.slice(0, 500) + '...' : dataStr;
      return `${base}\n    ${truncated.replace(/\n/g, '\n    ')}`;
    }

    return base;
  }).join('\n');
}

function getLevelIcon(level: string): string {
  switch (level) {
    case 'error': return 'ERR';
    case 'warn':  return 'WRN';
    case 'info':  return 'INF';
    case 'debug': return 'DBG';
    default:      return '???';
  }
}
