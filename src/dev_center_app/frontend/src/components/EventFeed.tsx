// ====== Code Summary ======
// Real-time monitoring events feed, connected to WS /api/monitoring/events.
// Reconnects with exponential backoff.

import { useEffect, useRef, useState } from 'react';
import theme from '../theme';
import { wsUrl } from '../api/client';
import type { MonitoringEvent } from '../api/types';

const MAX_EVENTS = 200;
const WS_PATH = '/api/monitoring/events';

function eventColor(type: string): string {
  if (type.startsWith('session.start'))  return theme.colors.active;
  if (type.startsWith('session.stop'))   return theme.colors.warning;
  if (type.startsWith('session.renew'))  return theme.colors.info;
  if (type.startsWith('session.expire')) return theme.colors.danger;
  return theme.colors.muted;
}

interface EventRow {
  ts: number;
  event: MonitoringEvent;
}

export default function EventFeed() {
  const [rows, setRows] = useState<EventRow[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const retryDelayRef = useRef(1_000);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

  const connect = () => {
    if (unmountedRef.current) return;
    const ws = new WebSocket(wsUrl(WS_PATH));
    wsRef.current = ws;

    ws.onopen = () => {
      if (unmountedRef.current) { ws.close(); return; }
      setConnected(true);
      retryDelayRef.current = 1_000;
    };

    ws.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data as string) as MonitoringEvent;
        if (event.type === 'ping') return;
        setRows((prev) => [{ ts: Date.now(), event }, ...prev].slice(0, MAX_EVENTS));
      } catch { /* ignore */ }
    };

    ws.onclose = () => {
      if (unmountedRef.current) return;
      setConnected(false);
      const delay = Math.min(retryDelayRef.current, 30_000);
      retryDelayRef.current = delay * 2;
      retryTimerRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => ws.close();
  };

  useEffect(() => {
    unmountedRef.current = false;
    connect();
    return () => {
      unmountedRef.current = true;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      wsRef.current?.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{
      background: theme.colors.surface,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.radius.lg,
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 16px',
        borderBottom: `1px solid ${theme.colors.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: theme.fontSize.sm, fontFamily: theme.font.sans, fontWeight: theme.fontWeight.semibold, color: theme.colors.text }}>
            Live Events
          </span>
          <span style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: connected ? theme.colors.active : theme.colors.muted,
            display: 'inline-block',
          }} />
          <span style={{ fontSize: theme.fontSize.xs, fontFamily: theme.font.mono, color: theme.colors.muted }}>
            {connected ? 'connected' : 'reconnectingâ€¦'}
          </span>
        </div>
        <button
          onClick={() => setRows([])}
          style={{
            padding: '2px 8px', background: 'none',
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.md,
            color: theme.colors.muted, cursor: 'pointer',
            fontSize: theme.fontSize.xs, fontFamily: theme.font.sans,
          }}
        >
          Clear
        </button>
      </div>

      <div style={{ maxHeight: '360px', overflowY: 'auto', fontFamily: theme.font.mono, fontSize: theme.fontSize.xs }}>
        {rows.length === 0 ? (
          <div style={{ padding: '24px 16px', color: theme.colors.muted, fontFamily: theme.font.sans, fontSize: theme.fontSize.sm, fontStyle: 'italic' }}>
            Waiting for eventsâ€¦
          </div>
        ) : rows.map((row, i) => (
          <div key={i} style={{
            display: 'flex', gap: '12px', padding: '6px 16px',
            borderBottom: `1px solid ${theme.colors.border}`, alignItems: 'flex-start',
          }}>
            <span style={{ color: theme.colors.muted, whiteSpace: 'nowrap', flexShrink: 0 }}>
              {new Date(row.ts).toLocaleTimeString()}
            </span>
            <span style={{ color: eventColor(row.event.type), whiteSpace: 'nowrap', flexShrink: 0 }}>
              {row.event.type}
            </span>
            <span style={{ color: theme.colors.textSecondary, flexShrink: 0 }}>
              {row.event.projectId}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

