import { apiFetch } from './client';
import type { MonitoringResponse } from './types';

export async function getMonitoring(): Promise<MonitoringResponse> {
  return apiFetch<MonitoringResponse>('/api/monitoring');
}

