import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PipelineEngine } from '../pipeline/pipeline-engine.js';
import { PipelineState, PipelineStage } from '../pipeline/types.js';
import { toolRegistry } from '../tools/tool-registry.js';
import { executeTool } from '../tools/tool-executor.js';
import { registerAllTools } from '../tools/index.js';
import { eventBus } from '../utils/event-bus.js';
import { logger } from '../utils/logger.js';
import { auditLogger } from '../auth/audit-logger.js';
import { ApiAuth } from '../auth/api-auth.js';
import { HaanWebSocket } from './websocket.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Find package root by searching upward for package.json
function findPackageRoot(startDir: string): string {
  let currentDir = startDir;
  while (currentDir !== path.dirname(currentDir)) {
    const packagePath = path.join(currentDir, 'package.json');
    if (fs.existsSync(packagePath)) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }
  return path.resolve(startDir, '..');
}

const PACKAGE_ROOT = findPackageRoot(__dirname);
const DASHBOARD_DIR = path.join(PACKAGE_ROOT, 'dashboard', 'dist');

const MAX_BODY_SIZE = 10 * 1024 * 1024; // 10MB
const REQUEST_TIMEOUT = 30000; // 30s

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
  '.webmanifest': 'application/manifest+json',
};

interface PipelineJob {
  id: string;
  task: string;
  mode: 'auto' | 'human';
  status: 'running' | 'completed' | 'failed';
  state: PipelineState | null;
  startedAt: number;
  completedAt?: number;
  error?: string;
}

/**
 * Lightweight REST API server for headless / CI/CD use.
 *
 * Routes:
 *   GET  /api/health             Health check
 *   GET  /api/status             Server status and active pipelines
 *   GET  /api/tools              List all registered tools
 *   POST /api/tools/:name        Execute a tool
 *   POST /api/pipeline           Start a pipeline
 *   GET  /api/pipeline/:id       Get pipeline status
 */
export class HaanApiServer {
  private server: http.Server | null = null;
  private ws: HaanWebSocket | null = null;
  private jobs: Map<string, PipelineJob> = new Map();
  private port: number;
  private startTime: number = Date.now();
  private auth: ApiAuth;

  constructor(port: number = 3333) {
    this.port = port;
    registerAllTools();
    this.auth = new ApiAuth();
    auditLogger.init();
  }

  async start(): Promise<void> {
    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res).catch(err => {
        logger.error('api-server', `Request error: ${(err as Error).message}`);
        if (!res.headersSent) {
          this.sendJson(res, 500, { error: 'Internal server error' });
        }
      });
    });

    this.ws = new HaanWebSocket(this.server);

    return new Promise((resolve, reject) => {
      this.server!.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          const msg = `Port ${this.port} is already in use. Kill it with: lsof -ti:${this.port} | xargs kill -9`;
          logger.error('api-server', msg);
          reject(new Error(msg));
        } else {
          reject(err);
        }
      });

      this.server!.listen(this.port, () => {
        this.server!.removeAllListeners('error');
        logger.info('api-server', `REST API server running on http://localhost:${this.port}`);
        console.log(`Haan.ai API server listening on http://localhost:${this.port}`);
        console.log(`  GET  /api/health`);
        console.log(`  GET  /api/status`);
        console.log(`  GET  /api/tools`);
        console.log(`  POST /api/tools/:name`);
        console.log(`  POST /api/pipeline`);
        console.log(`  GET  /api/pipeline/:id`);
        console.log(`  WS   /ws`);
        if (fs.existsSync(path.join(DASHBOARD_DIR, 'index.html'))) {
          console.log(`  UI   http://localhost:${this.port}`);
        }
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  getWs(): HaanWebSocket | null {
    return this.ws;
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url || '/', `http://localhost:${this.port}`);
    const method = req.method?.toUpperCase() || 'GET';
    const pathname = url.pathname;

    // CORS headers
    const origin = req.headers.origin || '';
    const allowedOrigins = ['http://localhost:5173', `http://localhost:${this.port}`];
    const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[1];
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Authentication
    if (this.auth.isEnabled()) {
      const identity = this.auth.authenticate(req);
      if (!identity) {
        this.sendJson(res, 401, { error: 'Unauthorized: missing or invalid API key' });
        return;
      }
      const action = this.auth.getRouteAction(method, pathname);
      if (!this.auth.hasPermission(identity.role, action)) {
        auditLogger.log('auth:forbidden', { role: identity.role, action, path: pathname }, identity.label);
        this.sendJson(res, 403, { error: `Forbidden: role "${identity.role}" cannot perform "${action}"` });
        return;
      }
    }

    // Audit log the request
    auditLogger.log('api:request', { method, path: pathname });

    // Static file serving for dashboard (non-API routes)
    if (!pathname.startsWith('/api/')) {
      return this.serveStatic(res, pathname);
    }

    // Route matching
    if (method === 'GET' && pathname === '/api/health') {
      return this.handleHealth(res);
    }

    if (method === 'GET' && pathname === '/api/status') {
      return this.handleStatus(res);
    }

    if (method === 'GET' && pathname === '/api/tools') {
      return this.handleListTools(res);
    }

    const toolMatch = pathname.match(/^\/api\/tools\/(.+)$/);
    if (method === 'POST' && toolMatch) {
      const body = await this.readBody(req);
      return this.handleExecuteTool(res, toolMatch[1], body);
    }

    if (method === 'POST' && pathname === '/api/pipeline') {
      const body = await this.readBody(req);
      return this.handleStartPipeline(res, body);
    }

    const pipelineMatch = pathname.match(/^\/api\/pipeline\/(.+)$/);
    if (method === 'GET' && pipelineMatch) {
      return this.handleGetPipeline(res, pipelineMatch[1]);
    }

    this.sendJson(res, 404, { error: 'Not found' });
  }

  private handleHealth(res: http.ServerResponse): void {
    const activeJobs = Array.from(this.jobs.values()).filter(j => j.status === 'running').length;
    this.sendJson(res, 200, {
      status: 'ok',
      uptime: Date.now() - this.startTime,
      tools: toolRegistry.names().length,
      activePipelines: activeJobs,
      wsClients: this.ws?.clientCount ?? 0,
      dashboardBuilt: fs.existsSync(path.join(DASHBOARD_DIR, 'index.html')),
    });
  }

  private handleStatus(res: http.ServerResponse): void {
    const jobs = Array.from(this.jobs.values()).map(j => ({
      id: j.id,
      task: j.task,
      status: j.status,
      startedAt: j.startedAt,
      completedAt: j.completedAt,
    }));

    this.sendJson(res, 200, {
      uptime: Date.now() - this.startTime,
      activePipelines: jobs.filter(j => j.status === 'running').length,
      totalPipelines: jobs.length,
      pipelines: jobs,
      tools: toolRegistry.names(),
    });
  }

  private handleListTools(res: http.ServerResponse): void {
    this.sendJson(res, 200, {
      tools: toolRegistry.getSchemas(),
    });
  }

  private async handleExecuteTool(
    res: http.ServerResponse,
    toolName: string,
    body: Record<string, unknown>,
  ): Promise<void> {
    if (!toolRegistry.has(toolName)) {
      this.sendJson(res, 404, {
        error: `Unknown tool: ${toolName}`,
        available: toolRegistry.names(),
      });
      return;
    }

    const args = (body.args || body) as Record<string, unknown>;
    if (body.args) delete args.args;

    try {
      const result = await executeTool(toolName, args, 'api');
      this.sendJson(res, result.isError ? 400 : 200, {
        tool: toolName,
        output: result.output,
        isError: result.isError,
        metadata: result.metadata,
      });
    } catch (err) {
      this.sendJson(res, 500, { error: `Tool execution failed: ${(err as Error).message}` });
    }
  }

  private async handleStartPipeline(
    res: http.ServerResponse,
    body: Record<string, unknown>,
  ): Promise<void> {
    const task = body.task as string;
    if (!task) {
      this.sendJson(res, 400, { error: 'Missing required field: task' });
      return;
    }

    const mode = (body.mode as 'auto' | 'human') || 'auto';
    const id = `pipeline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const job: PipelineJob = {
      id,
      task,
      mode,
      status: 'running',
      state: null,
      startedAt: Date.now(),
    };

    this.jobs.set(id, job);

    // Each pipeline gets its own engine to avoid state corruption
    const pipelineEngine = new PipelineEngine();
    pipelineEngine.execute({ task, mode }).then(state => {
      job.state = state;
      job.status = state.currentStage === PipelineStage.COMPLETE ? 'completed' : 'failed';
      job.completedAt = Date.now();
    }).catch(err => {
      job.status = 'failed';
      job.completedAt = Date.now();
      job.error = (err as Error).message;
      logger.error('api-server', `Pipeline ${id} failed: ${(err as Error).message}`);
    });

    this.sendJson(res, 202, { id, status: 'running', task, mode });
  }

  private handleGetPipeline(res: http.ServerResponse, id: string): void {
    const job = this.jobs.get(id);
    if (!job) {
      this.sendJson(res, 404, { error: `Pipeline not found: ${id}` });
      return;
    }

    const result: Record<string, unknown> = {
      id: job.id,
      task: job.task,
      mode: job.mode,
      status: job.status,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      error: job.error,
    };

    if (job.state) {
      const outputs: Record<string, unknown> = {};
      for (const [stage, output] of job.state.outputs) {
        outputs[stage] = {
          success: output.success,
          content: output.content.slice(0, 3000),
          duration: output.duration,
          tokensUsed: output.tokensUsed,
        };
      }
      result.currentStage = job.state.currentStage;
      result.retries = job.state.retryCount;
      result.outputs = outputs;
    }

    this.sendJson(res, 200, result);
  }

  private serveStatic(res: http.ServerResponse, pathname: string): void {
    // Normalize and resolve the path
    const normalizedPath = path.normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, '');
    let filePath = path.join(DASHBOARD_DIR, normalizedPath);

    // Path traversal protection: ensure we're still within DASHBOARD_DIR
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(path.resolve(DASHBOARD_DIR))) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }

    // SPA fallback: if no file extension, serve index.html
    const ext = path.extname(filePath);
    if (!ext) {
      filePath = path.join(DASHBOARD_DIR, 'index.html');
    }

    try {
      if (!fs.existsSync(filePath)) {
        filePath = path.join(DASHBOARD_DIR, 'index.html');
      }

      if (!fs.existsSync(filePath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Dashboard not built. Run: cd dashboard && npm run build');
        return;
      }

      const fileExt = path.extname(filePath);
      const contentType = MIME_TYPES[fileExt] || 'application/octet-stream';
      const content = fs.readFileSync(filePath);

      // Cache headers: cache immutable assets, don't cache HTML
      const headers: Record<string, string> = { 'Content-Type': contentType };
      if (fileExt !== '.html') {
        headers['Cache-Control'] = 'public, max-age=31536000, immutable';
      } else {
        headers['Cache-Control'] = 'no-cache';
      }

      res.writeHead(200, headers);
      res.end(content);
    } catch (err) {
      logger.error('api-server', `Static file error: ${(err as Error).message}`);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal server error');
    }
  }

  private readBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      let data = '';
      let size = 0;

      const timeout = setTimeout(() => {
        req.destroy();
        reject(new Error('Request timeout'));
      }, REQUEST_TIMEOUT);

      req.on('data', chunk => {
        size += chunk.length;
        if (size > MAX_BODY_SIZE) {
          clearTimeout(timeout);
          req.destroy();
          reject(new Error('Request body too large'));
          return;
        }
        data += chunk;
      });
      req.on('end', () => {
        clearTimeout(timeout);
        try {
          resolve(data ? JSON.parse(data) : {});
        } catch {
          reject(new Error('Invalid JSON body'));
        }
      });
      req.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  private sendJson(res: http.ServerResponse, status: number, body: unknown): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body, null, 2));
  }
}
