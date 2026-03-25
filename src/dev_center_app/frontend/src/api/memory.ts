import { apiFetch } from './client';
import type { MemoryResponse } from './types';

export async function getMemory(projectId: string): Promise<MemoryResponse> {
  return apiFetch<MemoryResponse>(`/api/projects/${projectId}/memory`);
}

