import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { theme } from '../../theme';
import { listProjects } from '../../api/projects';
import type { Project } from '../../api/types';
import ProjectCard from './ProjectCard';

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listProjects()
      .then((res) => setProjects(res.projects))
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: theme.colors.bg,
        color: theme.colors.text,
        fontFamily: theme.font.sans,
        padding: theme.spacing.xl,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.xl }}>
        <h1 style={{ margin: 0, fontSize: theme.font.size.xxl, fontFamily: theme.font.mono, color: theme.colors.text }}>
          IA-Dev-Hub
        </h1>
        <div style={{ display: 'flex', gap: theme.spacing.md }}>
          <Link
            to="/projects/new"
            style={{
              padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
              background: theme.colors.primary,
              color: theme.colors.onPrimary,
              borderRadius: theme.radius.md,
              textDecoration: 'none',
              fontSize: theme.font.size.md,
              fontWeight: 600,
            }}
          >
            + New Project
          </Link>
          <Link
            to="/settings"
            style={{
              padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
              border: `1px solid ${theme.colors.border}`,
              color: theme.colors.text,
              borderRadius: theme.radius.md,
              textDecoration: 'none',
              fontSize: theme.font.size.md,
            }}
          >
            Settings
          </Link>
        </div>
      </div>

      {/* Content */}
      {projects === null && !error && (
        <div style={{ color: theme.colors.muted }}>Loading...</div>
      )}
      {error && (
        <div style={{ color: theme.colors.danger }}>Error: {error}</div>
      )}
      {projects !== null && projects.length === 0 && (
        <div style={{ color: theme.colors.muted, textAlign: 'center', marginTop: theme.spacing.xl }}>
          No projects yet. <Link to="/projects/new" style={{ color: theme.colors.link }}>Create one →</Link>
        </div>
      )}
      {projects !== null && projects.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: theme.spacing.lg,
          }}
        >
          {projects.map((p) => (
            <ProjectCard key={p.groupId} project={p} />
          ))}
        </div>
      )}
    </div>
  );
}
