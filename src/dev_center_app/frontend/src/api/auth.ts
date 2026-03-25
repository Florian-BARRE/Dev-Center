import { apiFetch } from './client';
import type { AuthStatusResponse } from './types';

export async function getAuthStatus(): Promise<AuthStatusResponse> {
  return apiFetch<AuthStatusResponse>('/api/auth/status');
}

export async function postLogin(): Promise<void> {
  await apiFetch<void>('/api/auth/login', { method: 'POST' });
}

