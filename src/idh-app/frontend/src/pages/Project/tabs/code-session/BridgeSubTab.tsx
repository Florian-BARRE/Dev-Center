import { useState, useEffect, useRef } from 'react';
import type React from 'react';
import { theme } from '../../../../theme';
import CountdownTimer from '../../../../components/CountdownTimer';
import StatusBadge from '../../../../components/StatusBadge';
import { startBridge, stopBridge, renewBridge, openBridgeLogs, putAutoRenew } from '../../../../api/bridge';
import { getProject } from '../../../../api/projects';
import type { Project } from '../../../../api/types';

const LOG_PANEL_HEIGHT = '280px';

interface BridgeSubTabProps {
  project: Project;
  onProjectChange: (updated: Project) => void;
}

export default function BridgeSubTab({ project, onProjectChange }: BridgeSubTabProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [logFilter, setLogFilter] = useState('');
  const wsRef = useRef<WebSocket | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const isActive = project.bridge !== null;
  const bridgePid = project.bridge?.pid ?? null;

  // 1. Reconnect WebSocket when bridge PID changes
  useEffect(() => {
    wsRef.current?.close();
    wsRef.current = null;
    if (!isActive || bridgePid === null) return;
    setLogs([]);
    const ws = openBridgeLogs(project.groupId, (line) => setLogs((prev) => [...prev, line]));
    wsRef.current = ws;
    return () => ws.close();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridgePid, project.groupId]);

  // 2. Auto-scroll
  useEffect(() => {
    logsEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [logs]);

  const act = async (label: string, fn: () => Promise<unknown>) => {
    setLoading(label); setError(null);
    try {
      await fn();
      const updated = await getProject(project.groupId);
      onProjectChange(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally { setLoading(null); }
  };

  const toggleAutoRenew = async () => {
    const newVal = !(project.bridge?.autoRenew ?? false);
    await act('auto-renew', () => putAutoRenew(project.groupId, newVal));
  };

  const filteredLogs = logFilter
    ? logs.filter((l) => l.toLowerCase().includes(logFilter.toLowerCase()))
    : logs;

  const btnStyle = (variant: 'primary' | 'danger' | 'secondary'): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: theme.spacing.xs,
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    border: variant === 'secondary' ? `1px solid ${theme.colors.border}` : 'none',
    borderRadius: theme.radius.md,
    cursor: loading ? 'not-allowed' : 'pointer',
    fontSize: theme.font.size.sm, fontWeight: theme.font.weight.medium,
    background: variant === 'primary' ? theme.colors.primary : variant === 'danger' ? theme.colors.danger : theme.colors.surfaceElevated,
    color: variant === 'secondary' ? theme.colors.text : theme.colors.onPrimary,
    opacity: loading ? 0.6 : 1,
    transition: theme.transition.fast,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
      {/* Status bar */}
      <div style={{
        display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: theme.spacing.md,
        background: theme.colors.surface, border: `1px solid ${isActive ? theme.colors.success + '33' : theme.colors.border}`,
        borderRadius: theme.radius.lg, padding: theme.spacing.md,
      }}>
        <StatusBadge status={isActive ? 'active' : 'idle'} />
        {isActive && project.bridge && (
          <>
            <span style={{ fontSize: theme.font.size.xs, fontFamily: theme.font.mono, color: theme.colors.muted }}>
              PID {project.bridge.pid}
            </span>
            <span style={{ fontSize: theme.font.size.xs, fontFamily: theme.font.mono, color: theme.colors.warning }}>
              <CountdownTimer expiresAt={project.bridge.expiresAt} />
            </span>
            {/* Auto-Renew pill toggle */}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: theme.font.size.xs, color: theme.colors.muted }}>Auto-Renew</span>
              <button
                aria-label={project.bridge.autoRenew ? 'Auto-extend enabled' : 'Auto-extend disabled'}
                onClick={toggleAutoRenew}
                disabled={loading !== null}
                style={{
                  padding: `2px ${theme.spacing.sm}`,
                  background: project.bridge.autoRenew ? `${theme.colors.success}22` : theme.colors.surfaceElevated,
                  border: `1px solid ${project.bridge.autoRenew ? theme.colors.success : theme.colors.border}`,
                  borderRadius: theme.radius.full,
                  color: project.bridge.autoRenew ? theme.colors.success : theme.colors.muted,
                  fontSize: theme.font.size.xs, cursor: 'pointer',
                  transition: theme.transition.fast,
                }}>
                {project.bridge.autoRenew ? 'ON' : 'OFF'}
              </button>
            </span>
          </>
        )}
        {!isActive && (
          <span style={{ fontSize: theme.font.size.sm, color: theme.colors.muted }}>No bridge running</span>
        )}
        {/* Action buttons */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: theme.spacing.xs }}>
          {!isActive && (
            <button style={btnStyle('primary')} disabled={loading !== null}
              onClick={() => act('start', () => startBridge(project.groupId))}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              {loading === 'start' ? 'Starting…' : 'Start Bridge'}
            </button>
          )}
          {isActive && (
            <>
              <button style={btnStyle('secondary')} disabled={loading !== null}
                onClick={() => act('renew', () => renewBridge(project.groupId))}>
                {loading === 'renew' ? 'Renewing…' : 'Renew'}
              </button>
              <button style={btnStyle('danger')} disabled={loading !== null}
                onClick={() => act('stop', () => stopBridge(project.groupId))}>
                {loading === 'stop' ? 'Stopping…' : 'Stop'}
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div style={{ padding: `${theme.spacing.sm} ${theme.spacing.md}`, background: theme.colors.dangerBg, border: `1px solid ${theme.colors.danger}44`, borderRadius: theme.radius.sm, color: theme.colors.danger, fontSize: theme.font.size.sm }}>
          {error}
        </div>
      )}

      {/* Live output */}
      {isActive && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.sm }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: theme.colors.success, display: 'inline-block' }} />
            <span style={{ fontSize: theme.font.size.xs, color: theme.colors.muted, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: theme.font.weight.medium }}>
              Live Output
            </span>
            <input
              placeholder="Filter output…"
              value={logFilter}
              onChange={(e) => setLogFilter(e.target.value)}
              style={{
                marginLeft: 'auto',
                background: theme.colors.bg,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.radius.md,
                color: theme.colors.text,
                fontSize: theme.font.size.xs,
                fontFamily: theme.font.mono,
                padding: `2px ${theme.spacing.sm}`,
                outline: 'none',
                width: '180px',
              }}
            />
          </div>
          <div style={{
            background: theme.colors.terminalBg, border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.md, padding: theme.spacing.md,
            height: LOG_PANEL_HEIGHT, overflowY: 'auto',
            fontFamily: theme.font.mono, fontSize: theme.font.size.xs, lineHeight: 1.6, color: theme.colors.muted,
          }}>
            {filteredLogs.length === 0 && (
              <span style={{ color: `${theme.colors.muted}88` }}>
                {logFilter ? 'No lines match filter.' : 'Waiting for output…'}
              </span>
            )}
            {filteredLogs.map((line, i) => (
              <div key={i} style={{ color: line.toLowerCase().includes('error') ? theme.colors.danger : theme.colors.muted }}>
                {line}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}
    </div>
  );
}
