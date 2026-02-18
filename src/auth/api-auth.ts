import http from 'http';
import { logger } from '../utils/logger.js';

export type Role = 'admin' | 'developer' | 'viewer';

interface ApiKeyEntry {
  key: string;
  role: Role;
  label?: string;
}

/**
 * RBAC matrix: which roles can perform which actions.
 */
const ROLE_PERMISSIONS: Record<Role, Set<string>> = {
  admin: new Set(['pipeline:run', 'pipeline:view', 'tool:execute', 'tool:shell', 'config:modify', 'config:view', 'cost:view', 'audit:view']),
  developer: new Set(['pipeline:run', 'pipeline:view', 'tool:execute', 'config:view', 'cost:view']),
  viewer: new Set(['pipeline:view', 'config:view', 'cost:view']),
};

/**
 * API authentication middleware.
 * Validates API key from Authorization header or x-api-key header.
 */
export class ApiAuth {
  private keys: Map<string, ApiKeyEntry> = new Map();
  private enabled: boolean;

  constructor(enabled: boolean = false, apiKeys: ApiKeyEntry[] = []) {
    this.enabled = enabled;
    for (const entry of apiKeys) {
      this.keys.set(entry.key, entry);
    }
  }

  /**
   * Check if authentication is enabled.
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Authenticate a request and return the role.
   * Returns null if authentication fails.
   */
  authenticate(req: http.IncomingMessage): { role: Role; label?: string } | null {
    if (!this.enabled) {
      return { role: 'admin' }; // No auth = full access
    }

    const apiKey = this.extractApiKey(req);
    if (!apiKey) return null;

    const entry = this.keys.get(apiKey);
    if (!entry) return null;

    return { role: entry.role, label: entry.label };
  }

  /**
   * Check if a role has permission for an action.
   */
  hasPermission(role: Role, action: string): boolean {
    const perms = ROLE_PERMISSIONS[role];
    return perms ? perms.has(action) : false;
  }

  /**
   * Get the action string for a route.
   */
  getRouteAction(method: string, pathname: string): string {
    if (pathname === '/api/health') return 'config:view';
    if (pathname === '/api/status') return 'config:view';
    if (pathname === '/api/tools' && method === 'GET') return 'config:view';
    if (pathname.startsWith('/api/tools/') && method === 'POST') {
      // Check if it's shell-exec specifically
      const toolName = pathname.replace('/api/tools/', '');
      if (toolName === 'shell-exec') return 'tool:shell';
      return 'tool:execute';
    }
    if (pathname === '/api/pipeline' && method === 'POST') return 'pipeline:run';
    if (pathname.startsWith('/api/pipeline/') && method === 'GET') return 'pipeline:view';
    if (pathname === '/api/config' && method === 'GET') return 'config:view';
    if (pathname === '/api/config' && method === 'PATCH') return 'config:modify';
    if (pathname === '/api/audit') return 'audit:view';
    return 'config:view';
  }

  private extractApiKey(req: http.IncomingMessage): string | null {
    // Check x-api-key header
    const headerKey = req.headers['x-api-key'];
    if (typeof headerKey === 'string') return headerKey;

    // Check Authorization: Bearer <key>
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) {
      return auth.slice(7).trim();
    }

    return null;
  }
}
