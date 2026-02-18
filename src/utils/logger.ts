import fs from 'fs';
import path from 'path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

let logFile: fs.WriteStream | null = null;
let logFilePath: string | null = null;
let minLevel: LogLevel = 'info';

export function initLogger(projectRoot: string, level: LogLevel = 'info') {
  minLevel = level;
  const logDir = path.join(projectRoot, '.haan', 'logs');
  fs.mkdirSync(logDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  logFilePath = path.join(logDir, `session-${timestamp}.jsonl`);
  logFile = fs.createWriteStream(logFilePath, { flags: 'a' });

  // Clean up file handle on process exit
  const cleanup = () => {
    if (logFile) {
      try { logFile.end(); } catch { /* ignore */ }
      logFile = null;
    }
  };
  process.once('exit', cleanup);
  process.once('SIGINT', cleanup);
  process.once('SIGTERM', cleanup);
}

export function getLogFilePath(): string | null {
  return logFilePath;
}

function serializeData(data: unknown): unknown {
  if (data === undefined || data === null) return data;
  if (data instanceof Error) {
    return {
      message: data.message,
      name: data.name,
      stack: data.stack,
      ...(Object.keys(data).length > 0 ? { ...data } : {}),
    };
  }
  if (typeof data === 'object') {
    try {
      // Test if serializable; replace errors in nested objects
      JSON.stringify(data);
      return data;
    } catch {
      return String(data);
    }
  }
  return data;
}

function write(level: LogLevel, component: string, message: string, data?: unknown) {
  if (LOG_LEVELS[level] < LOG_LEVELS[minLevel]) return;
  const entry = {
    ts: new Date().toISOString(),
    level,
    component,
    message,
    ...(data !== undefined ? { data: serializeData(data) } : {}),
  };
  if (logFile) {
    logFile.write(JSON.stringify(entry) + '\n');
  }
}

export const logger = {
  debug: (component: string, msg: string, data?: unknown) => write('debug', component, msg, data),
  info: (component: string, msg: string, data?: unknown) => write('info', component, msg, data),
  warn: (component: string, msg: string, data?: unknown) => write('warn', component, msg, data),
  error: (component: string, msg: string, data?: unknown) => write('error', component, msg, data),
};
