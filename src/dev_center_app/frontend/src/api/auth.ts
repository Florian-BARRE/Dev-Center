import { apiFetch } from './client';
import type { AuthStatusResponse } from './types';

export async function getAuthStatus(): Promise<AuthStatusResponse> {
  return apiFetch<AuthStatusResponse>('/api/v1/auth/status');
}

export async function postLogin(): Promise<void> {
  await apiFetch<void>('/api/v1/auth/login', { method: 'POST' });
}
