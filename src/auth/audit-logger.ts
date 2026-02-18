import fs from 'fs';
import path from 'path';
import { getProjectRoot } from '../utils/path-utils.js';
import { eventBus } from '../utils/event-bus.js';
import { logger } from '../utils/logger.js';

interface AuditEntry {
  timestamp: string;
  event: string;
  actor?: string;
  details: Record<string, unknown>;
}

/**
 * Append-only JSONL audit logger.
 * Writes one JSON object per line to `.haan/audit.jsonl`.
 */
class AuditLogger {
  private logPath: string | null = null;
  private stream: fs.WriteStream | null = null;

  /**
   * Initialize audit logging. Subscribes to event bus for automatic logging.
   */
  init(): void {
    try {
      const root = getProjectRoot();
      const haanDir = path.join(root, '.haan');
      if (!fs.existsSync(haanDir)) {
        fs.mkdirSync(haanDir, { recursive: true });
      }
      this.logPath = path.join(haanDir, 'audit.jsonl');
      this.stream = fs.createWriteStream(this.logPath, { flags: 'a' });

      // Auto-log pipeline events
      eventBus.on('pipeline:stage_start', (data) => {
        this.log('pipeline:stage_start', { stage: data.stage, agent: data.agent });
      });
      eventBus.on('pipeline:stage_complete', (data) => {
        this.log('pipeline:stage_complete', { stage: data.stage });
      });
      eventBus.on('pipeline:complete', (data) => {
        this.log('pipeline:complete', { success: data.success });
      });
      eventBus.on('agent:tool_call', (data) => {
        this.log('agent:tool_call', {
          agent: data.agent,
          tool: data.tool,
          args: sanitizeArgs(data.args),
        });
      });

      logger.debug('audit', `Audit log initialized: ${this.logPath}`);
    } catch (err) {
      logger.warn('audit', `Failed to initialize audit logger: ${(err as Error).message}`);
    }
  }

  /**
   * Write an audit entry.
   */
  log(event: string, details: Record<string, unknown> = {}, actor?: string): void {
    const entry: AuditEntry = {
      timestamp: new Date().toISOString(),
      event,
      actor,
      details,
    };

    if (this.stream) {
      this.stream.write(JSON.stringify(entry) + '\n');
    }
  }

  /**
   * Read all audit entries (for the dashboard or API).
   */
  readAll(): AuditEntry[] {
    if (!this.logPath || !fs.existsSync(this.logPath)) return [];
    try {
      const content = fs.readFileSync(this.logPath, 'utf-8');
      return content
        .split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line) as AuditEntry);
    } catch {
      return [];
    }
  }

  /**
   * Read the last N audit entries.
   */
  readLast(n: number): AuditEntry[] {
    const all = this.readAll();
    return all.slice(-n);
  }

  /**
   * Close the audit log stream.
   */
  close(): void {
    if (this.stream) {
      this.stream.end();
      this.stream = null;
    }
  }
}

/**
 * Strip potentially sensitive arguments (API keys, passwords, etc.)
 */
function sanitizeArgs(args: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes('key') || lowerKey.includes('secret') || lowerKey.includes('password') || lowerKey.includes('token')) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'string' && value.length > 500) {
      sanitized[key] = value.slice(0, 500) + '...[truncated]';
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export const auditLogger = new AuditLogger();
