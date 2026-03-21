import { Link } from 'react-router-dom';
import { theme } from '../../theme';
import StatusBadge from '../../components/StatusBadge';
import CountdownTimer from '../../components/CountdownTimer';
import type { Project } from '../../api/types';

interface ProjectCardProps {
  project: Project;
}

export default function ProjectCard({ project }: ProjectCardProps) {
  const isBridgeActive = project.bridge !== null;

  return (
    <div
      style={{
        background: theme.colors.surface,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.radius.lg,
        padding: theme.spacing.lg,
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing.sm,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link
          to={`/projects/${encodeURIComponent(project.groupId)}`}
          style={{
            color: theme.colors.link,
            fontFamily: theme.font.mono,
            fontSize: theme.font.size.lg,
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          {project.projectId}
        </Link>
        <StatusBadge status={isBridgeActive ? 'active' : 'idle'} />
      </div>

      <div style={{ color: theme.colors.muted, fontFamily: theme.font.mono, fontSize: theme.font.size.sm }}>
        {project.repoUrl}
      </div>

      {project.modelOverride && (
        <div style={{ fontSize: theme.font.size.sm, color: theme.colors.muted }}>
          Model: {project.modelOverride.provider} / {project.modelOverride.model}
        </div>
      )}

      {project.bridge && (
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, fontSize: theme.font.size.sm }}>
          <span style={{ color: theme.colors.muted }}>Expires:</span>
          <CountdownTimer expiresAt={project.bridge.expiresAt} />
        </div>
      )}

      <div style={{ marginTop: theme.spacing.xs }}>
        <Link
          to={`/projects/${encodeURIComponent(project.groupId)}`}
          style={{
            display: 'inline-block',
            padding: `${theme.spacing.xs} ${theme.spacing.md}`,
            background: theme.colors.surface,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.md,
            color: theme.colors.text,
            fontSize: theme.font.size.sm,
            textDecoration: 'none',
          }}
        >
          Open →
        </Link>
      </div>
    </div>
  );
}
