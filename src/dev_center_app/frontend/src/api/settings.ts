import { apiFetch } from './client';
import type { GlobalConfigResponse } from './types';

export async function getSettings(): Promise<GlobalConfigResponse> {
  return apiFetch<GlobalConfigResponse>('/api/v1/settings');
}

export async function putSettings(body: Partial<GlobalConfigResponse>): Promise<GlobalConfigResponse> {
  return apiFetch<GlobalConfigResponse>('/api/v1/settings', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function getGlobalRules(): Promise<string> {
  const res = await apiFetch<{ content: string }>('/api/v1/settings/rules');
  return res.content;
}

export async function putGlobalRules(content: string): Promise<string> {
  const res = await apiFetch<{ content: string }>('/api/v1/settings/rules', {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
  return res.content;
}
