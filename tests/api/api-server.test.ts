import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { HaanApiServer } from '../../src/api/server.js';

// Use a high port to avoid conflicts
const TEST_PORT = 43210;
let server: HaanApiServer;

function fetch(path: string, options: { method?: string; body?: unknown } = {}): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const data = options.body ? JSON.stringify(options.body) : undefined;
    const req = http.request({
      hostname: 'localhost',
      port: TEST_PORT,
      path,
      method: options.method || 'GET',
      headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {},
    }, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode || 500, body: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode || 500, body: { raw: body } });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

describe('HaanApiServer', () => {
  beforeAll(async () => {
    server = new HaanApiServer(TEST_PORT);
    await server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  it('should respond to health check', async () => {
    const { status, body } = await fetch('/api/health');
    expect(status).toBe(200);
    expect(body.status).toBe('ok');
    expect(typeof body.uptime).toBe('number');
  });

  it('should list tools', async () => {
    const { status, body } = await fetch('/api/tools');
    expect(status).toBe(200);
    expect(Array.isArray(body.tools)).toBe(true);
    expect((body.tools as unknown[]).length).toBeGreaterThan(0);
  });

  it('should return status', async () => {
    const { status, body } = await fetch('/api/status');
    expect(status).toBe(200);
    expect(typeof body.uptime).toBe('number');
    expect(Array.isArray(body.tools)).toBe(true);
  });

  it('should return 404 for unknown routes', async () => {
    const { status } = await fetch('/api/nonexistent');
    expect(status).toBe(404);
  });

  it('should return 404 for unknown tool', async () => {
    const { status, body } = await fetch('/api/tools/nonexistent-tool', {
      method: 'POST',
      body: { args: {} },
    });
    expect(status).toBe(404);
    expect(body.error).toContain('Unknown tool');
  });

  it('should return 400 for pipeline without task', async () => {
    const { status, body } = await fetch('/api/pipeline', {
      method: 'POST',
      body: {},
    });
    expect(status).toBe(400);
    expect(body.error).toContain('task');
  });
});
