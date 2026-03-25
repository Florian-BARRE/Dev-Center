import { apiFetch } from './client';
import type { RulesResponse, RulesFilesResponse } from './types';

export async function getRules(projectId: string): Promise<RulesResponse> {
  return apiFetch<RulesResponse>(`/api/projects/${projectId}/rules`);
}

export async function putRules(projectId: string, content: string): Promise<RulesResponse> {
  return apiFetch<RulesResponse>(`/api/projects/${projectId}/rules`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
}

export async function syncRules(projectId: string): Promise<RulesResponse> {
  return apiFetch<RulesResponse>(`/api/projects/${projectId}/rules/sync`, {
    method: 'POST',
  });
}

export async function listRuleFiles(projectId: string): Promise<RulesFilesResponse> {
  return apiFetch<RulesFilesResponse>(`/api/projects/${projectId}/rules/files`);
}

export async function uploadRuleFiles(projectId: string, files: File[]): Promise<RulesResponse> {
  const form = new FormData();
  for (const f of files) form.append('files', f, f.name);
  // Use raw fetch â€” apiFetch forces Content-Type: application/json which breaks
  // multipart/form-data. Let the browser set the boundary automatically.
  const res = await fetch(`/api/projects/${projectId}/rules/files`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try { detail = await res.text(); } catch { /* ignore */ }
    throw new Error(detail);
  }
  return res.json() as Promise<RulesResponse>;
}

export async function deleteRuleFile(projectId: string, filename: string): Promise<RulesResponse> {
  return apiFetch<RulesResponse>(
    `/api/projects/${projectId}/rules/files/${encodeURIComponent(filename)}`,
    { method: 'DELETE' },
  );
}

