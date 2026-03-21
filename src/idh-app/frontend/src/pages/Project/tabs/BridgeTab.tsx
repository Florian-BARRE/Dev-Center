import { useState, useEffect, useRef } from 'react';
import type React from 'react';
import { theme } from '../../../theme';
import CountdownTimer from '../../../components/CountdownTimer';
import StatusBadge from '../../../components/StatusBadge';
import { startBridge, stopBridge, renewBridge, openBridgeLogs } from '../../../api/bridge';
import { getProject } from '../../../api/projects';
import type { Project } from '../../../api/types';

// Fixed height for the live log output panel
const LOG_PANEL_HEIGHT = '280px';

interface BridgeTabProps {
  project: Project;
  onProjectChange: (updated: Project) => void;
}

export default function BridgeTab({ project, onProjectChange }: BridgeTabProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const isActive = project.bridge !== null;

  // Connect WebSocket when bridge is active; close it when idle
  useEffect(() => {
    if (!isActive) {
      wsRef.current?.close();
      wsRef.current = null;
      return;
    }
    const ws = openBridgeLogs(project.groupId, (line) => {
      // Keep at most the last 200 lines to avoid unbounded memory growth
      setLogs((prev) => [...prev.slice(-199), line]);
    });
    wsRef.current = ws;
    return () => ws.close();
  }, [isActive, project.groupId]);

  // Auto-scroll to the bottom whenever new log lines arrive
  useEffect(() => {
    if (logsEndRef.current && typeof logsEndRef.current.scrollIntoView === 'function') {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Executes a bridge action, then refreshes the project state
  const act = async (label: string, fn: () => Promise<unknown>) => {
    setLoading(label);
    setError(null);
    try {
      await fn();
      const updated = await getProject(project.groupId);
      onProjectChange(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setLoading(null);
    }
  };

  const btnStyle = (variant: 'primary' | 'danger' | 'secondary'): React.CSSProperties => ({
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    border: variant === 'secondary' ? `1px solid ${theme.colors.border}` : 'none',
    borderRadius: theme.radius.md,
    cursor: loading ? 'not-allowed' : 'pointer',
    fontSize: theme.font.size.md,
    fontWeight: theme.font.weight.semibold,
    background:
      variant === 'primary' ? theme.colors.primary :
      variant === 'danger'  ? theme.colors.danger  :
      theme.colors.surface,
    color: variant === 'secondary' ? theme.colors.text : theme.colors.onPrimary,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.lg }}>

      {/* Status row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
        <StatusBadge status={isActive ? 'active' : 'idle'} />
        {isActive && project.bridge && (
          <div style={{ display: 'flex', gap: theme.spacing.lg, fontSize: theme.font.size.sm }}>
            <span style={{ color: theme.colors.muted }}>PID {project.bridge.pid}</span>
            <span style={{ color: theme.colors.muted }}>
              Expires: <CountdownTimer expiresAt={project.bridge.expiresAt} />
            </span>
          </div>
        )}
      </div>

      {/* Inline error message */}
      {error && (
        <div style={{ color: theme.colors.danger, fontSize: theme.font.size.sm }}>{error}</div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: theme.spacing.md, flexWrap: 'wrap' }}>
        {!isActive && (
          <button
            style={btnStyle('primary')}
            disabled={loading !== null}
            onClick={() => act('start', () => startBridge(project.groupId))}
          >
            {loading === 'start' ? 'Starting...' : 'Start Bridge'}
          </button>
        )}
        {isActive && (
          <>
            <button
              style={btnStyle('secondary')}
              disabled={loading !== null}
              onClick={() => act('renew', () => renewBridge(project.groupId))}
            >
              {loading === 'renew' ? 'Renewing...' : 'Renew'}
            </button>
            <button
              style={btnStyle('danger')}
              disabled={loading !== null}
              onClick={() => act('stop', () => stopBridge(project.groupId))}
            >
              {loading === 'stop' ? 'Stopping...' : 'Stop'}
            </button>
          </>
        )}
      </div>

      {/* Live log output — only shown when bridge is active */}
      {isActive && (
        <div>
          <div style={{
            fontSize: theme.font.size.sm,
            color: theme.colors.muted,
            marginBottom: theme.spacing.xs,
          }}>
            Live output
          </div>
          <div
            style={{
              background: theme.colors.terminalBg,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radius.md,
              padding: theme.spacing.md,
              height: LOG_PANEL_HEIGHT,
              overflowY: 'auto',
              fontFamily: theme.font.mono,
              fontSize: theme.font.size.xs,
              color: theme.colors.muted,
            }}
          >
            {logs.length === 0 && (
              <span style={{ color: theme.colors.muted }}>Waiting for output...</span>
            )}
            {logs.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
            {/* Sentinel div used to auto-scroll to the latest log entry */}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}
    </div>
  );
}
