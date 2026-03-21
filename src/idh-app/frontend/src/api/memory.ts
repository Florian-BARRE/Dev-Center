import { apiFetch } from './client';
import type { SessionMemoryResponse, TranscriptResponse, FileWriteResponse } from './types';

export function getSessionMemory(projectId: string): Promise<SessionMemoryResponse> {
  return apiFetch(`/api/v1/memory/${projectId}/session-memory`, { method: 'GET' });
}

export function putSessionMemory(projectId: string, content: string): Promise<FileWriteResponse> {
  return apiFetch(`/api/v1/memory/${projectId}/session-memory`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
}

export function getTranscript(projectId: string): Promise<TranscriptResponse> {
  return apiFetch(`/api/v1/memory/${projectId}/transcript`, { method: 'GET' });
}
