// ====== Code Summary ======
// LogBubble â€” floating bottom-right bubble that streams backend logs via WebSocket.
// Toggles open/closed; replays history on connect; auto-scrolls to newest line.
// Log lines are parsed for severity level and rendered with colored indicators.

import React, { useEffect, useRef, useState, useCallback } from 'react';
import theme from '../theme';

/** Maximum number of lines kept in the bubble at once. */
const MAX_LINES = 500;

type LogLevel = 'debug' | 'info' | 'success' | 'warning' | 'error' | 'critical';

interface LogLine {
  raw: string;
  level: LogLevel;
  timestamp: string | null;
  message: string;
}

/** Build the WebSocket URL for the /logs endpoint. */
function buildWsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const host = window.location.host;
  return `${proto}://${host}/api/logs`;
}

/** Extract ISO/HH:MM:SS timestamp from the start of a log line if present. */
function extractTimestamp(line: string): { timestamp: string | null; rest: string } {
  // Match patterns like: "2024-01-15 12:34:56" or "12:34:56.123" or "2024-01-15T12:34:56"
  const isoMatch = line.match(/^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?)\s*[|\-]?\s*/);
  if (isoMatch) return { timestamp: isoMatch[1].slice(11, 19) || isoMatch[1].slice(0, 19), rest: line.slice(isoMatch[0].length) };

  const timeMatch = line.match(/^(\d{2}:\d{2}:\d{2}(?:\.\d+)?)\s*[|\-]?\s*/);
  if (timeMatch) return { timestamp: timeMatch[1].slice(0, 8), rest: line.slice(timeMatch[0].length) };

  return { timestamp: null, rest: line };
}

/** Detect the log level from line content. */
function detectLevel(line: string): LogLevel {
  const l = line.toLowerCase();
  if (l.includes('critical') || l.includes('fatal'))             return 'critical';
  if (l.includes('error') || l.includes('exception'))            return 'error';
  if (l.includes('warning') || l.includes('warn'))               return 'warning';
  if (l.includes('success') || l.includes('started') ||
      l.includes('ready') || l.includes(' ok ') ||
      l.includes('done') || l.includes('connected'))             return 'success';
  if (l.includes('debug'))                                       return 'debug';
  return 'info';
}

/** Color for each log level. */
function levelColor(level: LogLevel): string {
  switch (level) {
    case 'critical': return theme.colors.logCritical;
    case 'error':    return theme.colors.logError;
    case 'warning':  return theme.colors.logWarning;
    case 'success':  return theme.colors.logSuccess;
    case 'debug':    return theme.colors.logDebug;
    default:         return theme.colors.logInfo;
  }
}

/** Level badge label (short). */
function levelBadge(level: LogLevel): string {
  switch (level) {
    case 'critical': return 'CRT';
    case 'error':    return 'ERR';
    case 'warning':  return 'WRN';
    case 'success':  return 'OK ';
    case 'debug':    return 'DBG';
    default:         return 'INF';
  }
}

/** Parse a raw log string into a structured LogLine. */
function parseLine(raw: string): LogLine {
  const { timestamp, rest } = extractTimestamp(raw);
  const level = detectLevel(raw);
  return { raw, level, timestamp, message: rest };
}

export default function LogBubble() {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<LogLine[]>([]);
  const [unread, setUnread] = useState(0);
  const [filter, setFilter] = useState<LogLevel | 'all'>('all');
  const bodyRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const openRef = useRef(open);

  openRef.current = open;

  const appendLine = useCallback((raw: string) => {
    setLines(prev => {
      const next = [...prev, parseLine(raw)];
      return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next;
    });
    if (!openRef.current) {
      setUnread(n => n + 1);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let retryTimeout: ReturnType<typeof setTimeout>;

    function connect() {
      if (cancelled) return;
      const ws = new WebSocket(buildWsUrl());
      wsRef.current = ws;

      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data) as { line: string };
          appendLine(data.line);
        } catch {
          appendLine(ev.data as string);
        }
      };

      ws.onclose = () => {
        retryTimeout = setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      cancelled = true;
      clearTimeout(retryTimeout);
      wsRef.current?.close();
    };
  }, [appendLine]);

  useEffect(() => {
    if (open && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [lines, open]);

  const handleToggle = () => {
    setOpen(o => {
      if (!o) setUnread(0);
      return !o;
    });
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLines([]);
    setUnread(0);
  };

  const visibleLines = filter === 'all'
    ? lines
    : lines.filter(l => l.level === filter);

  const errorCount = lines.filter(l => l.level === 'error' || l.level === 'critical').length;

  return (
    <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999 }}>
      {/* Expanded panel */}
      {open && (
        <div style={{
          position: 'absolute', bottom: '52px', right: 0,
          width: '620px', height: '360px',
          background: theme.colors.surface,
          border: `1px solid ${theme.colors.accent}25`,
          borderRadius: theme.radius.lg,
          display: 'flex', flexDirection: 'column',
          boxShadow: `0 20px 60px rgba(0,0,0,0.8), 0 0 0 1px ${theme.colors.accent}10, 0 0 30px ${theme.colors.accent}08`,
          overflow: 'hidden',
          animation: 'fadeUp 0.15s ease both',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 12px',
            borderBottom: `1px solid ${theme.colors.border}`,
            background: `${theme.colors.bg}CC`,
            flexShrink: 0,
            gap: theme.spacing.sm,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Live dot */}
              <span style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: theme.colors.active,
                display: 'inline-block',
                animation: 'pulse-dot 2s infinite',
                flexShrink: 0,
              }} />
              <span style={{
                fontFamily: theme.font.display,
                fontSize: theme.fontSize.xs,
                color: theme.colors.textSecondary,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}>
                Backend Logs
              </span>
              <span style={{
                fontFamily: theme.font.mono,
                fontSize: '10px',
                color: theme.colors.muted,
              }}>
                {lines.length}/{MAX_LINES}
              </span>
            </div>

            {/* Level filters */}
            <div style={{ display: 'flex', gap: '4px', flex: 1, justifyContent: 'center' }}>
              {(['all', 'error', 'warning', 'success', 'debug'] as const).map(f => (
                <button
                  key={f}
                  onClick={(e) => { e.stopPropagation(); setFilter(f); }}
                  style={{
                    padding: '1px 7px',
                    borderRadius: theme.radius.sm,
                    fontSize: '10px',
                    fontFamily: theme.font.display,
                    letterSpacing: '0.06em',
                    cursor: 'pointer',
                    border: `1px solid ${filter === f
                      ? (f === 'all' ? theme.colors.accent : levelColor(f as LogLevel)) + '80'
                      : theme.colors.border}`,
                    background: filter === f
                      ? (f === 'all' ? theme.colors.accent : levelColor(f as LogLevel)) + '18'
                      : 'transparent',
                    color: filter === f
                      ? (f === 'all' ? theme.colors.accent : levelColor(f as LogLevel))
                      : theme.colors.muted,
                    transition: 'all 0.15s',
                  }}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>

            <button
              onClick={handleClear}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: theme.font.sans, fontSize: theme.fontSize.xs,
                color: theme.colors.muted, padding: '2px 6px',
                borderRadius: theme.radius.sm,
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = theme.colors.danger; }}
              onMouseLeave={e => { e.currentTarget.style.color = theme.colors.muted; }}
            >
              Clear
            </button>
          </div>

          {/* Log body */}
          <div
            ref={bodyRef}
            style={{
              flex: 1, overflowY: 'auto', padding: '6px 0',
              fontFamily: theme.font.mono, fontSize: '11px',
              lineHeight: '1.7',
              whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            }}
          >
            {visibleLines.length === 0 ? (
              <div style={{ padding: '8px 12px', color: theme.colors.muted }}>
                {filter !== 'all' ? `No ${filter} messages.` : 'No logs yet.'}
              </div>
            ) : (
              visibleLines.map((line, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: '8px',
                  padding: '1px 10px',
                  background: (line.level === 'error' || line.level === 'critical')
                    ? `${levelColor(line.level)}08`
                    : 'transparent',
                  borderLeft: (line.level === 'error' || line.level === 'critical')
                    ? `2px solid ${levelColor(line.level)}60`
                    : '2px solid transparent',
                }}>
                  {/* Level badge */}
                  <span style={{
                    fontFamily: theme.font.display,
                    fontSize: '9px',
                    letterSpacing: '0.05em',
                    color: levelColor(line.level),
                    opacity: 0.85,
                    flexShrink: 0,
                    marginTop: '2px',
                    minWidth: '26px',
                  }}>
                    {levelBadge(line.level)}
                  </span>

                  {/* Timestamp */}
                  {line.timestamp && (
                    <span style={{
                      color: theme.colors.muted,
                      flexShrink: 0,
                      fontSize: '10px',
                      marginTop: '1px',
                    }}>
                      {line.timestamp}
                    </span>
                  )}

                  {/* Message */}
                  <span style={{ color: levelColor(line.level), flex: 1, opacity: line.level === 'debug' ? 0.6 : 1 }}>
                    {line.message}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Trigger button */}
      <button
        onClick={handleToggle}
        title="Backend logs"
        style={{
          width: '42px', height: '42px',
          borderRadius: theme.radius.md,
          background: open ? theme.colors.accent : theme.colors.surface,
          border: `1px solid ${open ? theme.colors.accent : theme.colors.border}`,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
          boxShadow: open
            ? `0 0 20px ${theme.colors.accent}50, 0 4px 12px rgba(0,0,0,0.5)`
            : '0 4px 12px rgba(0,0,0,0.5)',
          transition: 'background 0.15s, border-color 0.15s, box-shadow 0.15s',
        }}
      >
        {/* Terminal icon */}
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="2" width="14" height="12" rx="2"
            stroke={open ? theme.colors.bg : theme.colors.textSecondary}
            strokeWidth="1.5" />
          <path d="M4 6l3.5 2.5L4 11" stroke={open ? theme.colors.bg : theme.colors.accent}
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10 11h2" stroke={open ? theme.colors.bg : theme.colors.textSecondary}
            strokeWidth="1.5" strokeLinecap="round" />
        </svg>

        {/* Unread error badge (errors/warnings only get red badge) */}
        {!open && errorCount > 0 && (
          <span style={{
            position: 'absolute', top: '-5px', right: '-5px',
            minWidth: '17px', height: '17px',
            background: theme.colors.danger,
            borderRadius: theme.radius.full,
            fontFamily: theme.font.mono, fontSize: '9px',
            fontWeight: theme.fontWeight.bold,
            color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 3px',
            boxShadow: `0 0 6px ${theme.colors.danger}80`,
          }}>
            {errorCount > 99 ? '99+' : errorCount}
          </span>
        )}

        {/* Green unread badge (when no errors) */}
        {!open && unread > 0 && errorCount === 0 && (
          <span style={{
            position: 'absolute', top: '-5px', right: '-5px',
            minWidth: '17px', height: '17px',
            background: theme.colors.active,
            borderRadius: theme.radius.full,
            fontFamily: theme.font.mono, fontSize: '9px',
            fontWeight: theme.fontWeight.bold,
            color: theme.colors.bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 3px',
          }}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
    </div>
  );
}

