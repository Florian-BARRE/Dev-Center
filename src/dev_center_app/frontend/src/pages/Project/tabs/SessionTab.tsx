// ====== Code Summary ======
// Session tab — status info, start/stop/renew, auto-renew toggle, live logs.

import React, { useState } from 'react';
import theme from '../../../theme';
import { startSession, stopSession, renewSession } from '../../../api/sessions';
import { updateProject } from '../../../api/projects';
import LogPane from '../../../components/LogPane';
import CountdownTimer from '../../../components/CountdownTimer';
import ModelSelector from '../../../components/ModelSelector';
import ScheduleEditor from '../../../components/ScheduleEditor';
import type { Project } from '../../../api/types';

interface SessionTabProps {
  project: Project;
  onRefresh: () => void;
}

const cardStyle: React.CSSProperties = {
  background: theme.colors.surface,
  border: `1px solid ${theme.colors.border}`,
  borderRadius: theme.radius.md,
  padding: theme.spacing.lg,
  marginBottom: theme.spacing.md,
};

const labelStyle: React.CSSProperties = {
  fontFamily: theme.font.sans,
  fontSize: theme.fontSize.xs,
  color: theme.colors.muted,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '4px',
};

const valueStyle: React.CSSProperties = {
  fontFamily: theme.font.mono,
  fontSize: theme.fontSize.sm,
  color: theme.colors.text,
};

export default function SessionTab({ project, onRefresh }: SessionTabProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { session } = project;

  const act = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const toggleAutoRenew = async () => {
    if (!session) return;
    await act(() => updateProject(project.id, { autoRenew: !session.autoRenew }));
  };

  const btnBase: React.CSSProperties = {
    padding: '6px 14px',
    borderRadius: theme.radius.sm,
    fontSize: theme.fontSize.sm,
    fontFamily: theme.font.sans,
    fontWeight: theme.fontWeight.medium,
    cursor: busy ? 'not-allowed' : 'pointer',
    opacity: busy ? 0.6 : 1,
    border: `1px solid ${theme.colors.borderStrong}`,
    background: 'none',
    color: theme.colors.text,
  };

  return (
    <div>
      {/* Status card */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', gap: theme.spacing['2xl'], marginBottom: theme.spacing.md }}>
          {session ? (
            <>
              <div>
                <div style={labelStyle}>PID</div>
                <div style={valueStyle}>{session.pid}</div>
              </div>
              <div>
                <div style={labelStyle}>Started</div>
                <div style={valueStyle}>{new Date(session.startedAt).toLocaleString()}</div>
              </div>
              <div>
                <div style={labelStyle}>Expires</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CountdownTimer expiresAt={session.expiresAt} />
                  <span style={{ color: theme.colors.muted, fontSize: theme.fontSize.xs, fontFamily: theme.font.mono }}>
                    ({new Date(session.expiresAt).toLocaleTimeString()})
                  </span>
                </div>
              </div>
              <div>
                <div style={labelStyle}>Auto-renew</div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={session.autoRenew}
                    onChange={toggleAutoRenew}
                    disabled={busy}
                  />
                  <span style={{ fontFamily: theme.font.sans, fontSize: theme.fontSize.sm, color: theme.colors.text }}>
                    {session.autoRenew ? 'On' : 'Off'}
                  </span>
                </label>
              </div>
            </>
          ) : (
            <div style={{ color: theme.colors.muted, fontFamily: theme.font.sans, fontSize: theme.fontSize.sm }}>
              No active session
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: theme.spacing.sm, alignItems: 'center' }}>
          {!session && (
            <button
              onClick={() => act(() => startSession(project.id))}
              disabled={busy}
              style={{ ...btnBase, background: theme.colors.active, color: theme.colors.bg, border: 'none' }}
            >
              Start
            </button>
          )}
          {session && (
            <>
              <button
                onClick={() => act(() => stopSession(project.id))}
                disabled={busy}
                style={{ ...btnBase, color: theme.colors.danger, borderColor: theme.colors.danger + '55' }}
              >
                Stop
              </button>
              <button
                onClick={() => act(() => renewSession(project.id))}
                disabled={busy}
                style={btnBase}
              >
                Renew
              </button>
            </>
          )}
          {error && <span style={{ color: theme.colors.danger, fontSize: theme.fontSize.sm, fontFamily: theme.font.sans }}>{error}</span>}
        </div>
      </div>

      {/* Live logs */}
      {session && (
        <LogPane wsPath={`/api/v1/projects/${project.id}/session/logs`} />
      )}

      {/* Model + Schedule */}
      <div style={cardStyle}>
        <div style={{ marginBottom: theme.spacing.md }}>
          <div style={{ ...labelStyle, marginBottom: theme.spacing.sm }}>Model</div>
          <ModelSelector
            provider={project.provider}
            model={project.model}
            onChange={(provider, model) => act(() => updateProject(project.id, { provider, model }))}
            disabled={busy}
          />
        </div>
        <div>
          <div style={{ ...labelStyle, marginBottom: theme.spacing.sm }}>Schedule</div>
          <ScheduleEditor
            value={project.schedule}
            onChange={(schedule) => act(() => updateProject(project.id, { schedule }))}
          />
        </div>
      </div>
    </div>
  );
}
