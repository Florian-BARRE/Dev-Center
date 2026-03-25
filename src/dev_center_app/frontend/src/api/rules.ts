import { apiFetch } from './client';
import type { RulesResponse } from './types';

export async function getRules(projectId: string): Promise<RulesResponse> {
  return apiFetch<RulesResponse>(`/api/v1/projects/${projectId}/rules`);
}

export async function putRules(projectId: string, content: string): Promise<RulesResponse> {
  return apiFetch<RulesResponse>(`/api/v1/projects/${projectId}/rules`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
}

export async function syncRules(projectId: string): Promise<RulesResponse> {
  return apiFetch<RulesResponse>(`/api/v1/projects/${projectId}/rules/sync`, {
    method: 'POST',
  });
}
