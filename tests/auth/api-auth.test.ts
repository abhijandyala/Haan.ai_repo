import { describe, it, expect } from 'vitest';
import { ApiAuth } from '../../src/auth/api-auth.js';
import http from 'http';

function mockRequest(headers: Record<string, string> = {}): http.IncomingMessage {
  return { headers } as http.IncomingMessage;
}

describe('ApiAuth', () => {
  it('should return admin when auth is disabled', () => {
    const auth = new ApiAuth(false);
    const result = auth.authenticate(mockRequest());
    expect(result).toEqual({ role: 'admin' });
  });

  it('should reject missing API key when auth is enabled', () => {
    const auth = new ApiAuth(true, [{ key: 'test-key', role: 'admin' }]);
    const result = auth.authenticate(mockRequest());
    expect(result).toBeNull();
  });

  it('should authenticate valid x-api-key header', () => {
    const auth = new ApiAuth(true, [
      { key: 'admin-key', role: 'admin', label: 'Admin' },
    ]);
    const result = auth.authenticate(mockRequest({ 'x-api-key': 'admin-key' }));
    expect(result).toEqual({ role: 'admin', label: 'Admin' });
  });

  it('should authenticate valid Bearer token', () => {
    const auth = new ApiAuth(true, [
      { key: 'dev-key', role: 'developer' },
    ]);
    const result = auth.authenticate(mockRequest({ authorization: 'Bearer dev-key' }));
    expect(result).toEqual({ role: 'developer', label: undefined });
  });

  it('should reject invalid API key', () => {
    const auth = new ApiAuth(true, [{ key: 'valid-key', role: 'admin' }]);
    const result = auth.authenticate(mockRequest({ 'x-api-key': 'wrong-key' }));
    expect(result).toBeNull();
  });

  it('should check RBAC permissions correctly', () => {
    const auth = new ApiAuth(true);
    // Admin has all permissions
    expect(auth.hasPermission('admin', 'pipeline:run')).toBe(true);
    expect(auth.hasPermission('admin', 'tool:shell')).toBe(true);
    expect(auth.hasPermission('admin', 'config:modify')).toBe(true);

    // Developer can run pipelines but not shell or modify config
    expect(auth.hasPermission('developer', 'pipeline:run')).toBe(true);
    expect(auth.hasPermission('developer', 'tool:shell')).toBe(false);
    expect(auth.hasPermission('developer', 'config:modify')).toBe(false);

    // Viewer can only view
    expect(auth.hasPermission('viewer', 'pipeline:run')).toBe(false);
    expect(auth.hasPermission('viewer', 'pipeline:view')).toBe(true);
    expect(auth.hasPermission('viewer', 'cost:view')).toBe(true);
  });

  it('should map routes to actions', () => {
    const auth = new ApiAuth();
    expect(auth.getRouteAction('POST', '/api/pipeline')).toBe('pipeline:run');
    expect(auth.getRouteAction('GET', '/api/pipeline/123')).toBe('pipeline:view');
    expect(auth.getRouteAction('POST', '/api/tools/shell-exec')).toBe('tool:shell');
    expect(auth.getRouteAction('POST', '/api/tools/file-read')).toBe('tool:execute');
    expect(auth.getRouteAction('GET', '/api/health')).toBe('config:view');
  });
});
