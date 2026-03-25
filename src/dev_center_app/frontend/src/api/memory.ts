import { apiFetch } from './client';
import type { MemoryResponse } from './types';

export async function getMemory(projectId: string): Promise<MemoryResponse> {
  return apiFetch<MemoryResponse>(`/api/v1/projects/${projectId}/memory`);
}
