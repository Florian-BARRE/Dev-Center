import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { theme } from '../../theme';
import { listProjects } from '../../api/projects';
import type { Project } from '../../api/types';
import ProjectCard from './ProjectCard';

// ── Skeleton card ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div style={{
      background: theme.colors.surface,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.radius.lg,
      padding: '20px',
      boxShadow: 'none',
    }}>
      {[80, 140, 60, 100].map((w, i) => (
        <div key={i} style={{
          height: i === 0 ? '18px' : '12px',
          width: `${w}%`,
          maxWidth: `${w * 2.4}px`,
          marginBottom: '12px',
          borderRadius: theme.radius.sm,
          background: `linear-gradient(90deg, ${theme.colors.surfaceElevated} 0%, #1e1e3a 50%, ${theme.colors.surfaceElevated} 100%)`,
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.5s infinite',
        }} />
      ))}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: '80px',
      gap: '16px',
      animation: 'fadeIn 0.3s ease',
    }}>
      <div style={{
        width: '64px', height: '64px',
        borderRadius: theme.radius.xl,
        background: theme.colors.surfaceElevated,
        border: `1px solid ${theme.colors.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={theme.colors.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
          <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
        </svg>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: theme.font.display, fontWeight: theme.font.weight.semibold, fontSize: theme.font.size.lg, color: theme.colors.text, marginBottom: '6px' }}>
          No projects yet
        </div>
        <div style={{ fontSize: theme.font.size.md, color: theme.colors.muted }}>
          Create your first project to get started
        </div>
      </div>
      <Link
        to="/projects/new"
        style={{
          padding: '8px 20px',
          background: theme.colors.accent,
          color: theme.colors.onPrimary,
          borderRadius: theme.radius.md,
          fontFamily: theme.font.sans,
          fontWeight: theme.font.weight.semibold,
          fontSize: theme.font.size.md,
          textDecoration: 'none',
          marginTop: '4px',
        }}
      >
        + New Project
      </Link>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listProjects()
      .then((res) => setProjects(res.projects))
      .catch((e: Error) => setError(e.message));
  }, []);

  const activeCount = projects?.filter((p) => p.bridge !== null).length ?? 0;

  return (
    <div style={{
      padding: '32px',
      minHeight: '100vh',
      animation: 'fadeIn 0.3s ease',
    }}>
      {/* Page header */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        paddingBottom: '24px',
        borderBottom: `1px solid ${theme.colors.border}`,
        marginBottom: '24px',
      }}>
        <div>
          <h1 style={{
            margin: 0,
            fontFamily: theme.font.display,
            fontWeight: theme.font.weight.bold,
            fontSize: theme.font.size.xl,
            color: theme.colors.text,
            lineHeight: 1.1,
          }}>
            Dashboard
          </h1>
          {projects !== null && (
            <div style={{
              marginTop: '6px',
              fontFamily: theme.font.mono,
              fontSize: theme.font.size.sm,
              color: theme.colors.muted,
            }}>
              — {projects.length} project{projects.length !== 1 ? 's' : ''} · {activeCount} active bridge{activeCount !== 1 ? 's' : ''}
            </div>
          )}
        </div>
        <Link
          to="/projects/new"
          style={{
            padding: '8px 16px',
            background: theme.colors.accent,
            color: theme.colors.onPrimary,
            borderRadius: theme.radius.md,
            fontFamily: theme.font.sans,
            fontWeight: theme.font.weight.semibold,
            fontSize: theme.font.size.md,
            textDecoration: 'none',
            flexShrink: 0,
          }}
        >
          + New Project
        </Link>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '12px 16px',
          background: theme.colors.dangerBg,
          border: `1px solid ${theme.colors.danger}44`,
          borderRadius: theme.radius.md,
          color: theme.colors.danger,
          fontSize: theme.font.size.sm,
          marginBottom: '24px',
        }}>
          Failed to load projects: {error}
        </div>
      )}

      {/* Loading skeletons */}
      {projects === null && !error && (
        <div>
          <span style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', borderWidth: 0 }}>
            Loading...
          </span>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '16px',
          }}>
            {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
          </div>
        </div>
      )}

      {/* Empty state */}
      {projects !== null && projects.length === 0 && <EmptyState />}

      {/* Project grid */}
      {projects !== null && projects.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '16px',
        }}>
          {projects.map((p) => (
            <ProjectCard key={p.groupId} project={p} />
          ))}
        </div>
      )}
    </div>
  );
}
