import { useEffect, useState } from 'react';
import { useParams, Link, NavLink, Routes, Route } from 'react-router-dom';
import { theme } from '../../theme';
import { getProject } from '../../api/projects';
import { startBridge, stopBridge, renewBridge } from '../../api/bridge';
import type { Project } from '../../api/types';
import StatusBadge from '../../components/StatusBadge';
import CountdownTimer from '../../components/CountdownTimer';
import OverviewTab from './tabs/OverviewTab';
import TelegramTab from './tabs/TelegramTab';
import CodeSessionTab from './tabs/CodeSessionTab';

// ── Styles ────────────────────────────────────────────────────────────────────

const headerStripStyle: React.CSSProperties = {
  background: theme.colors.surface,
  borderBottom: `1px solid ${theme.colors.border}`,
  padding: '0 24px',
  height: '48px',
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing.md,
  flexShrink: 0,
};

const tabBarStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0',
  borderBottom: `1px solid ${theme.colors.border}`,
  padding: '0 24px',
  height: '40px',
  alignItems: 'flex-end',
  flexShrink: 0,
};

const tabLinkBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '0 12px',
  height: '40px',
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.medium,
  fontFamily: theme.font.sans,
  textDecoration: 'none',
  letterSpacing: '0.06em',
  cursor: 'pointer',
  background: 'none',
  border: 'none',
  borderBottomWidth: '2px',
  borderBottomStyle: 'solid',
  borderBottomColor: 'transparent',
  marginBottom: '-1px',
  transition: 'color 0.15s, border-color 0.15s',
};

function tabStyle(isActive: boolean): React.CSSProperties {
  return {
    ...tabLinkBase,
    color: isActive ? theme.colors.accent : theme.colors.muted,
    borderBottomColor: isActive ? theme.colors.accent : 'transparent',
  };
}

const actionBtnBase: React.CSSProperties = {
  padding: '5px 12px',
  border: `1px solid ${theme.colors.borderStrong}`,
  borderRadius: theme.radius.md,
  fontSize: theme.fontSize.xs,
  fontFamily: theme.font.sans,
  fontWeight: theme.fontWeight.medium,
  cursor: 'pointer',
  transition: 'opacity 0.15s',
};

// ── ProjectPage ───────────────────────────────────────────────────────────────

export default function ProjectPage() {
  const { groupId: rawGroupId } = useParams<{ groupId: string }>();
  const groupId = decodeURIComponent(rawGroupId ?? '');

  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // 1. Load project data on mount
  useEffect(() => {
    if (!groupId) return;
    setLoading(true);
    getProject(groupId)
      .then((p) => { setProject(p); setLoading(false); })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, [groupId]);

  // 2. Bridge action helper — calls fn, then refreshes project
  const act = async (fn: () => Promise<unknown>) => {
    if (actionBusy) return;
    setActionBusy(true);
    setActionError(null);
    try {
      await fn();
      const updated = await getProject(groupId);
      setProject(updated);
    } catch (err) {
      setActionError('Action failed. Please try again.');
    } finally {
      setActionBusy(false);
    }
  };

  // 3. Render loading state
  if (loading) {
    return (
      <div style={{ paddingTop: theme.nav.height }}>
        <div style={{ padding: theme.spacing.xl, color: theme.colors.muted, fontSize: theme.fontSize.sm, fontFamily: theme.font.sans }}>
          Loading…
        </div>
      </div>
    );
  }

  // 4. Render error state
  if (error) {
    return (
      <div style={{ paddingTop: theme.nav.height }}>
        <div style={{
          margin: theme.spacing.xl,
          padding: theme.spacing.lg,
          background: theme.colors.surface,
          border: `1px solid ${theme.colors.danger}44`,
          borderRadius: theme.radius.md,
          color: theme.colors.danger,
          fontSize: theme.fontSize.sm,
          fontFamily: theme.font.sans,
        }}>
          {error}
        </div>
      </div>
    );
  }

  if (!project) return null;

  const isActive = project.bridge !== null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', paddingTop: theme.nav.height }}>

      {/* Header strip */}
      <div style={headerStripStyle}>

        {/* Breadcrumb */}
        <Link
          to="/"
          style={{
            color: theme.colors.textSecondary,
            fontSize: theme.fontSize.xs,
            fontFamily: theme.font.sans,
            textDecoration: 'none',
            flexShrink: 0,
          }}
        >
          ← Projects
        </Link>

        <span style={{ color: theme.colors.borderStrong, fontSize: theme.fontSize.sm }}>/</span>

        {/* Project name */}
        <span style={{
          fontSize: theme.fontSize.sm,
          fontWeight: theme.fontWeight.semibold,
          fontFamily: theme.font.sans,
          color: theme.colors.text,
          flexShrink: 0,
        }}>
          {project.projectId}
        </span>

        {/* Status badge */}
        <StatusBadge status={isActive ? 'active' : 'idle'} />

        {/* Countdown — only when bridge is active */}
        {isActive && project.bridge && (
          <CountdownTimer expiresAt={project.bridge.expiresAt} />
        )}

        {/* Action buttons — pushed to the right */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: theme.spacing.sm, alignItems: 'center', flexWrap: 'wrap' }}>
          {!isActive && (
            <button
              onClick={() => act(() => startBridge(groupId))}
              disabled={actionBusy}
              style={{
                ...actionBtnBase,
                background: theme.colors.active,
                color: theme.colors.bg,
                border: 'none',
                opacity: actionBusy ? 0.6 : 1,
              }}
            >
              Start
            </button>
          )}
          {isActive && (
            <>
              <button
                onClick={() => act(() => stopBridge(groupId))}
                disabled={actionBusy}
                style={{
                  ...actionBtnBase,
                  background: 'none',
                  color: theme.colors.danger,
                  borderColor: `${theme.colors.danger}55`,
                  opacity: actionBusy ? 0.6 : 1,
                }}
              >
                Stop
              </button>
              <button
                onClick={() => act(() => renewBridge(groupId))}
                disabled={actionBusy}
                style={{
                  ...actionBtnBase,
                  background: 'none',
                  color: theme.colors.text,
                  opacity: actionBusy ? 0.6 : 1,
                }}
              >
                Renew
              </button>
            </>
          )}
        </div>
        {actionError && (
          <span style={{ color: theme.colors.danger, fontSize: theme.fontSize.sm, marginLeft: theme.spacing.sm }}>
            {actionError}
          </span>
        )}
      </div>

      {/* Tab bar */}
      <div style={tabBarStyle}>
        <NavLink
          to=""
          end
          style={({ isActive }) => tabStyle(isActive)}
        >
          OVERVIEW
        </NavLink>
        <NavLink
          to="telegram"
          style={({ isActive }) => tabStyle(isActive)}
        >
          SESSION TELEGRAM
        </NavLink>
        <NavLink
          to="code"
          style={({ isActive }) => tabStyle(isActive)}
        >
          SESSION CODE
        </NavLink>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'auto', padding: theme.spacing.xl }}>
        <Routes>
          <Route index element={<OverviewTab groupId={groupId} />} />
          <Route path="telegram" element={<TelegramTab groupId={groupId} />} />
          <Route path="code" element={<CodeSessionTab groupId={groupId} />} />
        </Routes>
      </div>

    </div>
  );
}
