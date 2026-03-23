import { useEffect, useRef, useState } from 'react';
import { theme } from '../theme';
import { createMonitoringSocket } from '../api/monitoring';

interface WsEvent {
  type: string;
  ts: string;
  group_id: string | null;
  payload: Record<string, unknown>;
}

const MAX_EVENTS = 200;

// Map event type prefix to a display color using new theme tokens
function eventColor(type: string): string {
  const prefix = type.split('.')[0];
  if (prefix === 'session')    return theme.colors.active;
  if (prefix === 'scheduler')  return theme.colors.warning;
  if (prefix === 'error')      return theme.colors.danger;
  if (prefix === 'memory')     return theme.colors.textSecondary;
  return theme.colors.muted;
}

export default function EventFeed() {
  const [events, setEvents] = useState<WsEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const retryDelayRef = useRef(1000);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

  const connect = () => {
    if (unmountedRef.current) return;
    const ws = createMonitoringSocket();
    wsRef.current = ws;

    ws.onopen = () => {
      if (unmountedRef.current) { ws.close(); return; }
      setConnected(true);
      // Reset backoff on successful connection.
      retryDelayRef.current = 1000;
    };

    ws.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data as string) as WsEvent;
        setEvents((prev) => [event, ...prev].slice(0, MAX_EVENTS));
      } catch {
        // Ignore malformed messages — the server may send non-JSON frames.
      }
    };

    ws.onclose = () => {
      if (unmountedRef.current) return;
      setConnected(false);
      // Exponential backoff reconnect: 1s → 2s → 4s → … → 30s max.
      const delay = Math.min(retryDelayRef.current, 30_000);
      retryDelayRef.current = delay * 2;
      retryTimerRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      // Close triggers onclose which schedules the reconnect.
      ws.close();
    };
  };

  useEffect(() => {
    unmountedRef.current = false;
    connect();
    return () => {
      unmountedRef.current = true;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      wsRef.current?.close();
    };
  // connect is defined outside useEffect and is stable — no deps needed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{
      background: theme.colors.surface,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.radius.lg,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 16px',
        borderBottom: `1px solid ${theme.colors.border}`,
        background: theme.colors.surface,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontSize: theme.fontSize.sm,
            fontFamily: theme.font.sans,
            fontWeight: theme.fontWeight.semibold,
            color: theme.colors.text,
          }}>
            Live Events
          </span>
          {/* Connection status dot */}
          <span style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: connected ? theme.colors.active : theme.colors.muted,
            display: 'inline-block',
            transition: 'background 0.3s',
          }} />
          <span style={{
            fontSize: theme.fontSize.xs,
            fontFamily: theme.font.mono,
            color: theme.colors.muted,
          }}>
            {connected ? 'connected' : 'reconnecting\u2026'}
          </span>
        </div>
        <button
          onClick={() => setEvents([])}
          style={{
            padding: '2px 8px',
            background: 'none',
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.md,
            color: theme.colors.muted,
            cursor: 'pointer',
            fontSize: theme.fontSize.xs,
            fontFamily: theme.font.sans,
          }}
        >
          Clear
        </button>
      </div>

      {/* Event list */}
      <div style={{
        maxHeight: '360px',
        overflowY: 'auto',
        fontFamily: theme.font.mono,
        fontSize: theme.fontSize.xs,
      }}>
        {events.length === 0 ? (
          <div style={{
            padding: '24px 16px',
            color: theme.colors.muted,
            fontFamily: theme.font.sans,
            fontSize: theme.fontSize.sm,
            fontStyle: 'italic',
          }}>
            Waiting for events\u2026
          </div>
        ) : (
          events.map((ev, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: '12px',
                padding: '6px 0',
                borderBottom: `1px solid ${theme.colors.border}`,
                alignItems: 'flex-start',
                paddingLeft: '16px',
                paddingRight: '16px',
              }}
            >
              {/* Timestamp */}
              <span style={{
                color: theme.colors.muted,
                fontFamily: theme.font.mono,
                fontSize: theme.fontSize.xs,
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}>
                {new Date(ev.ts).toLocaleTimeString()}
              </span>

              {/* Event type */}
              <span style={{
                fontFamily: theme.font.sans,
                fontSize: theme.fontSize.sm,
                color: eventColor(ev.type),
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}>
                {ev.type}
              </span>

              {/* Group ID (project name) */}
              {ev.group_id && (
                <span style={{
                  fontFamily: theme.font.mono,
                  fontSize: theme.fontSize.xs,
                  color: theme.colors.textSecondary,
                  flexShrink: 0,
                }}>
                  {ev.group_id}
                </span>
              )}

              {/* Payload summary */}
              <span style={{
                color: theme.colors.muted,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {Object.entries(ev.payload)
                  .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
                  .join(' ')}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
