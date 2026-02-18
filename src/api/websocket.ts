import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { eventBus, HaanEvents } from '../utils/event-bus.js';
import { logger } from '../utils/logger.js';
import { PipelineEngine } from '../pipeline/pipeline-engine.js';

interface WsMessage {
  type: string;
  [key: string]: unknown;
}

interface OutgoingEvent {
  type: 'event';
  event: string;
  data: Record<string, unknown>;
  timestamp: number;
}

const HEARTBEAT_INTERVAL = 30_000;

const ALL_EVENTS: (keyof HaanEvents)[] = [
  'agent:thinking',
  'agent:reasoning',
  'agent:idle',
  'agent:streaming',
  'agent:tool_call',
  'agent:tool_result',
  'agent:complete',
  'agent:error',
  'pipeline:stage_start',
  'pipeline:stage_complete',
  'pipeline:stage_error',
  'pipeline:approval_needed',
  'pipeline:complete',
  'pipeline:retry',
  'pipeline:improvement',
  'pipeline:start',
  'pipeline:parallel_group',
  'pipeline:checkpoint',
  'pipeline:failover',
  'pipeline:validation_error',
  'ui:message',
  'ui:clear',
  'cost:update',
];

export class HaanWebSocket {
  private wss: WebSocketServer;
  private clients: Set<WebSocket> = new Set();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pendingApprovals: Map<string, (approved: boolean) => void> = new Map();
  private pipeline: PipelineEngine;

  constructor(server: http.Server) {
    this.pipeline = new PipelineEngine();
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws) => {
      this.clients.add(ws);
      logger.info('websocket', `Client connected (${this.clients.size} total)`);

      (ws as WebSocket & { isAlive: boolean }).isAlive = true;

      ws.on('pong', () => {
        (ws as WebSocket & { isAlive: boolean }).isAlive = true;
      });

      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString()) as WsMessage;
          this.handleClientMessage(msg);
        } catch {
          logger.warn('websocket', 'Received invalid JSON from client');
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        logger.info('websocket', `Client disconnected (${this.clients.size} total)`);
      });

      ws.on('error', (err) => {
        logger.error('websocket', `Client error: ${err.message}`);
        this.clients.delete(ws);
      });
    });

    this.startHeartbeat();
    this.subscribeToEvents();
  }

  get clientCount(): number {
    return this.clients.size;
  }

  close(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    for (const ws of this.clients) {
      ws.close();
    }
    this.clients.clear();
    this.wss.close();
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      for (const ws of this.clients) {
        const client = ws as WebSocket & { isAlive: boolean };
        if (!client.isAlive) {
          client.terminate();
          this.clients.delete(ws);
          continue;
        }
        client.isAlive = false;
        ws.ping();
      }
    }, HEARTBEAT_INTERVAL);
  }

  private subscribeToEvents(): void {
    for (const event of ALL_EVENTS) {
      eventBus.on(event, (data: HaanEvents[typeof event]) => {
        // Strip the resolve callback from approval_needed before sending over the wire
        if (event === 'pipeline:approval_needed') {
          const approvalData = data as HaanEvents['pipeline:approval_needed'];
          this.pendingApprovals.set(approvalData.stage, approvalData.resolve);
          const { resolve: _resolve, ...safeData } = approvalData;
          this.broadcast(event, safeData as Record<string, unknown>);
          return;
        }
        this.broadcast(event, data as Record<string, unknown>);
      });
    }
  }

  private broadcast(event: string, data: Record<string, unknown>): void {
    const message: OutgoingEvent = {
      type: 'event',
      event,
      data,
      timestamp: Date.now(),
    };
    const payload = JSON.stringify(message);

    for (const ws of this.clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }

  private handleClientMessage(msg: WsMessage): void {
    switch (msg.type) {
      case 'start_pipeline': {
        const task = msg.task as string;
        const mode = (msg.mode as string) || 'auto';
        if (!task) {
          logger.warn('websocket', 'start_pipeline missing task field');
          return;
        }
        logger.info('websocket', `Starting pipeline via WS: "${task}" mode=${mode}`);
        this.pipeline.execute({ task, mode: mode as 'auto' | 'human' }).catch((err) => {
          logger.error('websocket', `Pipeline failed: ${(err as Error).message}`);
        });
        break;
      }

      case 'approve': {
        const stage = msg.stage as string;
        const approved = msg.approved as boolean;
        if (!stage) {
          logger.warn('websocket', 'approve missing stage field');
          return;
        }
        const resolve = this.pendingApprovals.get(stage);
        if (resolve) {
          resolve(approved);
          this.pendingApprovals.delete(stage);
          logger.info('websocket', `Stage "${stage}" ${approved ? 'approved' : 'rejected'} via WS`);
        } else {
          logger.warn('websocket', `No pending approval for stage "${stage}"`);
        }
        break;
      }

      default:
        logger.warn('websocket', `Unknown message type: ${msg.type}`);
    }
  }
}
