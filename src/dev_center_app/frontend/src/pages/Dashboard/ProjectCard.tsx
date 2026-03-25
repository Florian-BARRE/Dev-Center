// ====== Code Summary ======
// Single project card: name, status badge, model, TTL countdown, start/stop button.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import theme from '../../theme';
import StatusBadge from '../../components/StatusBadge';
import CountdownTimer from '../../components/CountdownTimer';
import { startSession, stopSession } from '../../api/sessions';
import type { Project } from '../../api/types';

interface ProjectCardProps {
  project: Project;
  onRefresh: () => void;
}

export function ProjectCard({ project, onRefresh }: ProjectCardProps) {
  const [busy, setBusy] = useState(false);

  const act = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      onRefresh();
    } catch { /* errors visible in logs */ }
    finally { setBusy(false); }
  };

  return (
    <div style={{
      background: theme.colors.surface,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.radius.md,
      padding: theme.spacing.lg,
      marginBottom: theme.spacing.sm,
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing.md,
      transition: 'border-color 0.15s',
    }}>
      {/* Name + status */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <Link to={`/projects/${project.id}`} style={{
          fontFamily: theme.font.sans,
          fontSize: theme.fontSize.md,
          fontWeight: theme.fontWeight.semibold,
          color: theme.colors.text,
          textDecoration: 'none',
          display: 'block',
          marginBottom: '4px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {project.name}
        </Link>
        <div style={{ display: 'flex', gap: theme.spacing.sm, alignItems: 'center' }}>
          <StatusBadge status={project.status === 'active' ? 'active' : project.status === 'cloning' ? 'cloning' : 'idle'} />
          <span style={{ color: theme.colors.muted, fontSize: theme.fontSize.xs, fontFamily: theme.font.mono }}>
            {project.model}
          </span>
        </div>
      </div>

      {/* TTL countdown */}
      {project.session && (
        <CountdownTimer expiresAt={project.session.expiresAt} />
      )}

      {/* Start / Stop button */}
      {project.status !== 'cloning' && (
        <button
          onClick={() =>
            project.session
              ? act(() => stopSession(project.id))
              : act(() => startSession(project.id))
          }
          disabled={busy}
          style={{
            padding: '5px 14px',
            borderRadius: theme.radius.sm,
            fontSize: theme.fontSize.xs,
            fontFamily: theme.font.sans,
            fontWeight: theme.fontWeight.medium,
            cursor: busy ? 'not-allowed' : 'pointer',
            opacity: busy ? 0.6 : 1,
            border: 'none',
            background: project.session ? 'none' : theme.colors.active,
            color: project.session ? theme.colors.danger : theme.colors.bg,
            borderWidth: project.session ? '1px' : '0',
            borderStyle: 'solid',
            borderColor: project.session ? theme.colors.danger + '55' : 'transparent',
          }}
        >
          {project.session ? 'Stop' : 'Start'}
        </button>
      )}
    </div>
  );
}
