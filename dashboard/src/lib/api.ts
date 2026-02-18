const BASE = '';  // Same origin — proxied by Vite to Python backend (localhost:8000)

// ── Health & Status ──

export async function fetchHealth(): Promise<{ status: string; version: string }> {
  const res = await fetch(`${BASE}/api/health`);
  return res.json();
}

export async function fetchStatus() {
  const res = await fetch(`${BASE}/api/status`);
  return res.json();
}

// ── Tools ──

export async function fetchTools(): Promise<{ tools: { name: string; description: string }[]; count: number }> {
  const res = await fetch(`${BASE}/api/tools`);
  return res.json();
}

// ── Pipeline ──

export async function startPipeline(
  task: string,
  mode: string = 'auto',
  options?: { stages?: string[]; model?: string; provider?: string },
) {
  const res = await fetch(`${BASE}/api/pipeline/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task, mode, ...options }),
  });
  return res.json();
}

export async function getPipelineState() {
  const res = await fetch(`${BASE}/api/pipeline/state`);
  return res.json();
}

export async function approvePipeline(stage: string, approved: boolean) {
  const res = await fetch(`${BASE}/api/pipeline/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stage, approved }),
  });
  return res.json();
}

// ── Threads ──

export interface ThreadData {
  id: string;
  title: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  created_at: number;
  updated_at: number;
  messages: { role: string; content: string; agent?: string; timestamp: number }[];
  file_changes: number;
}

export async function fetchThreads(): Promise<{ threads: ThreadData[]; count: number }> {
  const res = await fetch(`${BASE}/api/threads`);
  return res.json();
}

export async function createThread(title: string = 'New Thread'): Promise<ThreadData> {
  const res = await fetch(`${BASE}/api/threads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  return res.json();
}

export async function fetchThread(threadId: string): Promise<ThreadData> {
  const res = await fetch(`${BASE}/api/threads/${threadId}`);
  return res.json();
}

// ── Models ──

export interface ModelData {
  provider: string;
  model: string;
  available: boolean;
}

export async function fetchModels(): Promise<{ models: ModelData[]; default_provider: string; default_model: string }> {
  const res = await fetch(`${BASE}/api/models`);
  return res.json();
}
