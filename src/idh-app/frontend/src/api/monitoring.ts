import { apiFetch } from './client';
import type { TimelineResponse, ActivityLogResponse } from './types';

export function getTimeline(): Promise<TimelineResponse> {
  return apiFetch('/api/v1/monitoring/timeline', { method: 'GET' });
}

export function getActivityLog(limit = 100): Promise<ActivityLogResponse> {
  return apiFetch(`/api/v1/monitoring/activity?limit=${limit}`, { method: 'GET' });
}
