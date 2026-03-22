import { apiFetch } from './client';
import type { BridgeStatusResponse, BridgeActionResponse } from './types';

export function getBridgeStatus(groupId: string): Promise<BridgeStatusResponse> {
  return apiFetch(`/api/v1/bridge/${groupId}`, { method: 'GET' });
}

export function startBridge(groupId: string): Promise<BridgeActionResponse> {
  return apiFetch(`/api/v1/bridge/${groupId}/start`, { method: 'POST' });
}

export function stopBridge(groupId: string): Promise<BridgeActionResponse> {
  return apiFetch(`/api/v1/bridge/${groupId}`, { method: 'DELETE' });
}

export function renewBridge(groupId: string): Promise<BridgeActionResponse> {
  return apiFetch(`/api/v1/bridge/${groupId}/renew`, { method: 'POST' });
}

/** Opens a WebSocket to stream bridge logs. Returns the WebSocket instance. */
export function openBridgeLogs(groupId: string, onLine: (line: string) => void): WebSocket {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${window.location.host}/api/v1/bridge/${groupId}/logs`);
  ws.onmessage = (e) => onLine(e.data as string);
  return ws;
}

export function putAutoRenew(groupId: string, autoRenew: boolean): Promise<BridgeActionResponse> {
  return apiFetch(`/api/v1/bridge/${groupId}/auto-renew`, {
    method: 'PUT',
    body: JSON.stringify({ autoRenew }),
  });
}
