import { apiFetch } from './client';
import type { TimelineResponse, ActivityLogResponse } from './types';

export function getTimeline(): Promise<TimelineResponse> {
  return apiFetch('/api/v1/monitoring/timeline', { method: 'GET' });
}

export function getActivityLog(limit = 100): Promise<ActivityLogResponse> {
  return apiFetch(`/api/v1/monitoring/activity?limit=${limit}`, { method: 'GET' });
}

/** Opens a WebSocket to the real-time monitoring event stream. Caller owns lifecycle. */
export function createMonitoringSocket(): WebSocket {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return new WebSocket(`${protocol}//${window.location.host}/api/v1/monitoring/ws`);
}
