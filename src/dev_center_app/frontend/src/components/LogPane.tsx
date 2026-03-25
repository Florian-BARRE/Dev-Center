// ====== Code Summary ======
// Auto-scrolling log pane connected to a WebSocket endpoint.
// Reconnects automatically using exponential backoff.

import { useEffect, useRef, useState } from 'react';
import theme from '../theme';
import { wsUrl } from '../api/client';

interface LogPaneProps {
  wsPath: string;    // e.g. "/api/v1/projects/myproj/session/logs"
  maxLines?: number;
}

export default function LogPane({ wsPath, maxLines = 500 }: LogPaneProps) {
  const [lines, setLines] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const retryDelayRef = useRef(1_000);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

  const connect = () => {
    if (unmountedRef.current) return;
    const ws = new WebSocket(wsUrl(wsPath));
    wsRef.current = ws;

    ws.onopen = () => {
      if (unmountedRef.current) { ws.close(); return; }
      setConnected(true);
      retryDelayRef.current = 1_000;
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string) as { line?: string };
        if (msg.line !== undefined) {
          setLines((prev) => [...prev, msg.line!].slice(-maxLines));
        }
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
  }, [wsPath]);

  // Auto-scroll to bottom when new lines arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  return (
    <div style={{
      background: theme.colors.bg,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.radius.md,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      minHeight: '200px',
      maxHeight: '400px',
    }}>
      {/* Status bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '4px 12px',
        borderBottom: `1px solid ${theme.colors.border}`,
        background: theme.colors.surface,
      }}>
        <span style={{ fontSize: theme.fontSize.xs, fontFamily: theme.font.sans, color: theme.colors.muted }}>
          Session logs
        </span>
        <span style={{
          fontSize: theme.fontSize.xs,
          fontFamily: theme.font.mono,
          color: connected ? theme.colors.active : theme.colors.muted,
        }}>
          {connected ? '● live' : '○ reconnecting…'}
        </span>
      </div>

      {/* Log content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '8px 12px',
        fontFamily: theme.font.mono,
        fontSize: theme.fontSize.xs,
        color: theme.colors.textSecondary,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
      }}>
        {lines.length === 0 ? (
          <span style={{ color: theme.colors.muted, fontStyle: 'italic' }}>No output yet…</span>
        ) : (
          lines.map((line, i) => (
            <div key={i}>{line}</div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
