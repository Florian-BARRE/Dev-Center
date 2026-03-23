import { useEffect, useRef, useState } from 'react';
import { theme } from '../theme';
import { createLogsSocket } from '../api/monitoring';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LogRecord {
  ts: string;
  level: string;
  message: string;
  logger: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_ENTRIES = 500;
const INITIAL_RETRY_DELAY = 1_000;
const MAX_RETRY_DELAY = 30_000;

// Level → colour mapping
const LEVEL_COLORS: Record<string, string> = {
  DEBUG:    theme.colors.muted,
  INFO:     theme.colors.accent,
  SUCCESS:  theme.colors.success,
  WARNING:  theme.colors.warning,
  ERROR:    theme.colors.danger,
  CRITICAL: theme.colors.danger,
};

function levelColor(level: string): string {
  return LEVEL_COLORS[level.toUpperCase()] ?? theme.colors.textSecondary;
}

// ── LogConsole ────────────────────────────────────────────────────────────────

export default function LogConsole() {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<LogRecord[]>([]);
  const [connected, setConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const retryDelayRef = useRef(INITIAL_RETRY_DELAY);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom when new logs arrive and panel is open
  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, open]);

  // WebSocket connection with exponential backoff reconnect
  useEffect(() => {
    unmountedRef.current = false;

    function connect() {
      if (unmountedRef.current) return;

      const ws = createLogsSocket();
      wsRef.current = ws;

      ws.onopen = () => {
        if (unmountedRef.current) return;
        setConnected(true);
        retryDelayRef.current = INITIAL_RETRY_DELAY;
      };

      ws.onmessage = (e) => {
        if (unmountedRef.current) return;
        try {
          const record = JSON.parse(e.data) as LogRecord;
          setLogs((prev) => [...prev, record].slice(-MAX_ENTRIES));
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (unmountedRef.current) return;
        setConnected(false);
        // Schedule reconnect with exponential backoff
        const delay = Math.min(retryDelayRef.current, MAX_RETRY_DELAY);
        retryDelayRef.current = delay * 2;
        retryTimerRef.current = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      unmountedRef.current = true;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      wsRef.current?.close();
    };
  }, []);

  return (
    <>
      {/* Floating panel — shown when open */}
      {open && (
        <div style={{
          position: 'fixed',
          bottom: '72px',
          right: '16px',
          width: '520px',
          height: '340px',
          display: 'flex',
          flexDirection: 'column',
          background: theme.colors.terminalBg,
          border: `1px solid ${theme.colors.borderAccent}`,
          borderRadius: theme.radius.lg,
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          zIndex: 9000,
          overflow: 'hidden',
        }}>
          {/* Panel header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 12px',
            borderBottom: `1px solid ${theme.colors.border}`,
            background: theme.colors.surface,
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: theme.colors.accent, fontSize: theme.font.size.xs, fontFamily: theme.font.mono }}>
                LOGS
              </span>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: connected ? theme.colors.success : theme.colors.danger,
                display: 'inline-block',
              }} />
              <span style={{ color: theme.colors.muted, fontSize: theme.font.size.xs, fontFamily: theme.font.sans }}>
                {connected ? 'live' : 'reconnecting…'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setLogs([])}
                style={{
                  background: 'none',
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.radius.sm,
                  color: theme.colors.muted,
                  fontSize: theme.font.size.xs,
                  fontFamily: theme.font.sans,
                  padding: '2px 8px',
                  cursor: 'pointer',
                }}
              >
                Clear
              </button>
              <button
                onClick={() => setOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: theme.colors.muted,
                  fontSize: '16px',
                  lineHeight: 1,
                  cursor: 'pointer',
                  padding: '0 2px',
                }}
              >
                ×
              </button>
            </div>
          </div>

          {/* Log entries */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px 0',
            fontFamily: theme.font.mono,
            fontSize: theme.font.size.xs,
          }}>
            {logs.length === 0 && (
              <div style={{ padding: '12px 16px', color: theme.colors.muted }}>
                Waiting for logs…
              </div>
            )}
            {logs.map((log, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: '8px',
                  padding: '2px 12px',
                  lineHeight: 1.5,
                  borderBottom: `1px solid ${theme.colors.bg}`,
                }}
              >
                {/* Timestamp */}
                <span style={{ color: theme.colors.muted, flexShrink: 0, fontSize: '10px' }}>
                  {new Date(log.ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                {/* Level badge */}
                <span style={{
                  color: levelColor(log.level),
                  flexShrink: 0,
                  width: '52px',
                  fontWeight: theme.font.weight.semibold,
                }}>
                  {log.level.toUpperCase().slice(0, 7)}
                </span>
                {/* Logger name */}
                <span style={{ color: theme.colors.purple, flexShrink: 0, maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {log.logger}
                </span>
                {/* Message */}
                <span style={{ color: theme.colors.text, wordBreak: 'break-all' }}>
                  {log.message}
                </span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </div>
      )}

      {/* Floating bubble button */}
      <button
        onClick={() => setOpen((v) => !v)}
        title="Logs temps réel"
        style={{
          position: 'fixed',
          bottom: '16px',
          right: '16px',
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          background: open ? theme.colors.accent : theme.colors.surface,
          border: `1px solid ${open ? theme.colors.accent : theme.colors.borderAccent}`,
          boxShadow: open
            ? `0 0 16px ${theme.colors.accentGlow}`
            : '0 4px 16px rgba(0,0,0,0.4)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9001,
          transition: 'all 0.15s ease',
        }}
      >
        {/* Terminal icon */}
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke={open ? theme.colors.bg : theme.colors.accent}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="4 17 10 11 4 5" />
          <line x1="12" y1="19" x2="20" y2="19" />
        </svg>
        {/* Unread dot — visible when panel is closed and logs are arriving */}
        {!open && connected && (
          <span style={{
            position: 'absolute',
            top: '6px',
            right: '6px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: theme.colors.success,
            border: `2px solid ${theme.colors.bg}`,
          }} />
        )}
      </button>
    </>
  );
}
