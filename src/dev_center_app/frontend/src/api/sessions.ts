import { apiFetch } from './client';
import type { SessionResponse } from './types';

const BASE = '/api/v1';

export async function startSession(projectId: string): Promise<SessionResponse> {
  return apiFetch<SessionResponse>(`${BASE}/projects/${projectId}/session/start`, {
    method: 'POST',
  });
}

export async function stopSession(projectId: string): Promise<void> {
  await apiFetch<void>(`${BASE}/projects/${projectId}/session/stop`, { method: 'POST' });
}

export async function renewSession(projectId: string): Promise<SessionResponse> {
  return apiFetch<SessionResponse>(`${BASE}/projects/${projectId}/session/renew`, {
    method: 'POST',
  });
}
