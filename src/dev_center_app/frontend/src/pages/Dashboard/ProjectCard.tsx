// ====== Code Summary ======
// ProjectCard renders one project with live status, quick actions, and key runtime info.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { startSession, stopSession } from '../../api/sessions';
import type { Project } from '../../api/types';
import CountdownTimer from '../../components/CountdownTimer';
import StatusBadge from '../../components/StatusBadge';
import theme from '../../theme';

interface ProjectCardProps {
  project: Project;
  onRefresh: () => void;
}

function shortModel(model: string): string {
  return model.replace(/^claude-/, '').replace(/-(\d)-(\d)(-\d+)?$/, '-$1.$2');
}

export function ProjectCard({ project, onRefresh }: ProjectCardProps): JSX.Element {
  const [busy, setBusy] = useState(false);
  const [hovered, setHovered] = useState(false);

  const runAction = async (action: () => Promise<unknown>): Promise<void> => {
    if (busy) return;

    setBusy(true);
    try {
      await action();
      onRefresh();
    } catch {
      // Errors are already surfaced through backend logs and alert API responses.
    } finally {
      setBusy(false);
    }
  };

  const status = project.status === 'active' ? 'active' : project.status === 'cloning' ? 'cloning' : 'idle';
  const isCloning = project.status === 'cloning';

  return (
    <article
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '14px',
        borderRadius: theme.radius.lg,
        border: `1px solid ${hovered ? theme.colors.borderStrong : theme.colors.border}`,
        background: hovered ? theme.colors.surfaceHover : theme.colors.surface,
        transition: 'all 0.16s',
      }}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <Link
            to={`/projects/${project.id}`}
            style={{
              display: 'block',
              color: theme.colors.text,
              fontFamily: theme.font.display,
              fontSize: theme.fontSize.md,
              fontWeight: theme.fontWeight.semibold,
              letterSpacing: '0.03em',
              textDecoration: 'none',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {project.name}
          </Link>
          <div style={{
            marginTop: '4px',
            color: theme.colors.muted,
            fontFamily: theme.font.mono,
            fontSize: '10px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {project.workspacePath || 'Workspace pending clone'}
          </div>
        </div>
        <StatusBadge status={status} />
      </header>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: '8px',
      }}>
        <div style={{
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.radius.md,
          padding: '7px 8px',
          background: `${theme.colors.bg}A0`,
        }}>
          <div style={{
            fontFamily: theme.font.display,
            fontSize: '10px',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: theme.colors.textSecondary,
          }}>
            Model
          </div>
          <div style={{
            marginTop: '2px',
            fontFamily: theme.font.mono,
            fontSize: theme.fontSize.sm,
            color: theme.colors.text,
          }}>
            {shortModel(project.model)}
          </div>
        </div>

        <div style={{
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.radius.md,
          padding: '7px 8px',
          background: `${theme.colors.bg}A0`,
        }}>
          <div style={{
            fontFamily: theme.font.display,
            fontSize: '10px',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: theme.colors.textSecondary,
          }}>
            Session TTL
          </div>
          <div style={{ marginTop: '2px', fontFamily: theme.font.mono, fontSize: theme.fontSize.sm }}>
            {project.session ? (
              <CountdownTimer expiresAt={project.session.expiresAt} />
            ) : (
              <span style={{ color: theme.colors.muted }}>Inactive</span>
            )}
          </div>
        </div>
      </div>

      <footer style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={() => {
            if (isCloning) return;
            if (project.session) {
              void runAction(() => stopSession(project.id));
              return;
            }
            void runAction(() => startSession(project.id));
          }}
          disabled={busy || isCloning}
          style={{
            flex: 1,
            border: `1px solid ${project.session ? `${theme.colors.danger}66` : `${theme.colors.active}66`}`,
            borderRadius: theme.radius.md,
            background: project.session ? `${theme.colors.danger}22` : `${theme.colors.active}22`,
            color: project.session ? theme.colors.danger : theme.colors.active,
            padding: '7px 10px',
            fontFamily: theme.font.display,
            fontSize: '11px',
            fontWeight: theme.fontWeight.semibold,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            cursor: busy || isCloning ? 'not-allowed' : 'pointer',
            opacity: busy || isCloning ? 0.55 : 1,
          }}
        >
          {isCloning ? 'Cloning...' : busy ? 'Running...' : project.session ? 'Stop Session' : 'Start Session'}
        </button>

        <Link
          to={`/projects/${project.id}`}
          style={{
            border: `1px solid ${theme.colors.borderStrong}`,
            borderRadius: theme.radius.md,
            color: theme.colors.textSecondary,
            textDecoration: 'none',
            padding: '7px 10px',
            fontFamily: theme.font.display,
            fontSize: '11px',
            fontWeight: theme.fontWeight.medium,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            background: `${theme.colors.bg}A0`,
          }}
        >
          Open
        </Link>
      </footer>
    </article>
  );
}
