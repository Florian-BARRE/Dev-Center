// ====== Code Summary ======
// Project detail page — header strip + tab bar (Session, Rules, Memory).

import React, { useEffect, useState } from 'react';
import { useParams, Link, NavLink, Routes, Route } from 'react-router-dom';
import theme from '../../theme';
import { getProject } from '../../api/projects';
import { startSession, stopSession } from '../../api/sessions';
import StatusBadge from '../../components/StatusBadge';
import CountdownTimer from '../../components/CountdownTimer';
import type { Project } from '../../api/types';
import SessionTab from './tabs/SessionTab';
import RulesTab from './tabs/RulesTab';
import MemoryTab from './tabs/MemoryTab';

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
  borderBottom: `1px solid ${theme.colors.border}`,
  padding: '0 24px',
  height: '40px',
  alignItems: 'flex-end',
  flexShrink: 0,
};

function tabStyle(isActive: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center',
    padding: '0 12px', height: '40px',
    fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.medium,
    fontFamily: theme.font.sans, textDecoration: 'none',
    letterSpacing: '0.06em', cursor: 'pointer',
    background: 'none', border: 'none',
    borderBottom: isActive ? `2px solid ${theme.colors.accent}` : '2px solid transparent',
    marginBottom: '-1px',
    color: isActive ? theme.colors.accent : theme.colors.muted,
    transition: 'color 0.15s, border-color 0.15s',
  };
}

export default function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);

  const load = async () => {
    if (!projectId) return;
    try {
      const p = await getProject(projectId);
      setProject(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (fn: () => Promise<unknown>) => {
    if (actionBusy) return;
    setActionBusy(true);
    try { await fn(); await load(); }
    catch { /* ignore */ }
    finally { setActionBusy(false); }
  };

  if (loading) return <div style={{ padding: theme.spacing.xl, color: theme.colors.muted, fontFamily: theme.font.sans, fontSize: theme.fontSize.sm }}>Loading…</div>;
  if (error)   return <div style={{ margin: theme.spacing.xl, padding: theme.spacing.lg, color: theme.colors.danger, fontFamily: theme.font.sans, fontSize: theme.fontSize.sm, background: theme.colors.surface, border: `1px solid ${theme.colors.danger}44`, borderRadius: theme.radius.md }}>{error}</div>;
  if (!project) return null;

  const status = project.status === 'active' ? 'active' : project.status === 'cloning' ? 'cloning' : 'idle';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header strip */}
      <div style={headerStripStyle}>
        <Link to="/" style={{ color: theme.colors.textSecondary, fontSize: theme.fontSize.xs, fontFamily: theme.font.sans, textDecoration: 'none', flexShrink: 0 }}>
          ← Projects
        </Link>
        <span style={{ color: theme.colors.borderStrong, fontSize: theme.fontSize.sm }}>/</span>
        <span style={{ fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold, fontFamily: theme.font.sans, color: theme.colors.text, flexShrink: 0 }}>
          {project.name}
        </span>
        <StatusBadge status={status} />
        {project.session && <CountdownTimer expiresAt={project.session.expiresAt} />}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: theme.spacing.sm }}>
          {!project.session && project.status !== 'cloning' && (
            <button
              onClick={() => act(() => startSession(project.id))}
              disabled={actionBusy}
              style={{ padding: '5px 12px', borderRadius: theme.radius.sm, fontSize: theme.fontSize.xs, fontFamily: theme.font.sans, fontWeight: theme.fontWeight.medium, cursor: 'pointer', background: theme.colors.active, color: theme.colors.bg, border: 'none', opacity: actionBusy ? 0.6 : 1 }}
            >
              Start
            </button>
          )}
          {project.session && (
            <button
              onClick={() => act(() => stopSession(project.id))}
              disabled={actionBusy}
              style={{ padding: '5px 12px', borderRadius: theme.radius.sm, fontSize: theme.fontSize.xs, fontFamily: theme.font.sans, fontWeight: theme.fontWeight.medium, cursor: 'pointer', background: 'none', color: theme.colors.danger, border: `1px solid ${theme.colors.danger}55`, opacity: actionBusy ? 0.6 : 1 }}
            >
              Stop
            </button>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div style={tabBarStyle}>
        <NavLink to=""  end      style={({ isActive }) => tabStyle(isActive)}>SESSION</NavLink>
        <NavLink to="rules"      style={({ isActive }) => tabStyle(isActive)}>RULES</NavLink>
        <NavLink to="memory"     style={({ isActive }) => tabStyle(isActive)}>MEMORY</NavLink>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'auto', padding: theme.spacing.xl }}>
        <Routes>
          <Route index element={<SessionTab project={project} onRefresh={load} />} />
          <Route path="rules"  element={<RulesTab projectId={project.id} />} />
          <Route path="memory" element={<MemoryTab projectId={project.id} />} />
        </Routes>
      </div>
    </div>
  );
}
