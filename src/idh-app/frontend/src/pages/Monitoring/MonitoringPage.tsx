import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { theme } from '../../theme';
import { listProjects } from '../../api/projects';
import { getTimeline, getActivityLog } from '../../api/monitoring';
import type { Project, TimelineResponse, ActivityEntry } from '../../api/types';
import StatusBadge from '../../components/StatusBadge';
import CountdownTimer from '../../components/CountdownTimer';
import TimelineChart from '../../components/TimelineChart';
import ActivityFeed from '../../components/ActivityFeed';
import EventFeed from '../../components/EventFeed';

// ── Stat card ─────────────────────────────────────────────────────────────────

interface StatCardProps { label: string; value: string | number; sub?: string; accent?: string; icon: ReactNode; }

function StatCard({ label, value, sub, accent, icon }: StatCardProps) {
  const accentColor = accent ?? theme.colors.accent;
  return (
    <div style={{
      background: theme.colors.surface,
      border: `1px solid ${theme.colors.border}`,
      borderLeft: `3px solid ${accentColor}`,
      borderRadius: theme.radius.lg,
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      boxShadow: theme.shadow.card,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontSize: '10px',
          fontFamily: theme.font.sans,
          color: theme.colors.muted,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          fontWeight: theme.font.weight.semibold,
        }}>
          {label}
        </span>
        <span style={{ color: accentColor, opacity: 0.7 }}>{icon}</span>
      </div>
      <div style={{
        fontSize: theme.font.size.display,
        fontFamily: theme.font.display,
        fontWeight: theme.font.weight.bold,
        color: accentColor,
        lineHeight: 1,
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: theme.font.size.xs, color: theme.colors.muted }}>{sub}</div>
      )}
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 style={{
        margin: `0 0 12px`,
        fontSize: theme.font.size.sm,
        fontFamily: theme.font.sans,
        fontWeight: theme.font.weight.semibold,
        color: theme.colors.muted,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
      }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

// ── Project row ───────────────────────────────────────────────────────────────

function ProjectRow({ project }: { project: Project }) {
  const isActive = project.bridge !== null;
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr auto auto auto',
      gap: '16px',
      alignItems: 'center',
      padding: '10px 16px',
      borderBottom: `1px solid ${theme.colors.border}`,
      transition: theme.transition.fast,
    }}>
      <div style={{ minWidth: 0 }}>
        <Link
          to={`/projects/${encodeURIComponent(project.groupId)}/code-session`}
          style={{
            textDecoration: 'none',
            color: theme.colors.text,
            fontWeight: theme.font.weight.medium,
            fontSize: theme.font.size.md,
            fontFamily: theme.font.sans,
          }}
        >
          {project.projectId}
        </Link>
        <div style={{
          fontSize: theme.font.size.xs,
          color: theme.colors.muted,
          fontFamily: theme.font.mono,
          marginTop: '2px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {project.groupId}
        </div>
      </div>
      <div style={{
        fontSize: theme.font.size.xs,
        fontFamily: theme.font.mono,
        color: isActive ? theme.colors.muted : `${theme.colors.muted}44`,
        minWidth: '80px',
        textAlign: 'right',
      }}>
        {isActive ? `PID ${project.bridge!.pid}` : '—'}
      </div>
      <div style={{
        fontSize: theme.font.size.xs,
        fontFamily: theme.font.mono,
        color: isActive ? theme.colors.warning : `${theme.colors.muted}44`,
        minWidth: '80px',
        textAlign: 'right',
      }}>
        {isActive ? <CountdownTimer expiresAt={project.bridge!.expiresAt} /> : '—'}
      </div>
      <div><StatusBadge status={isActive ? 'active' : 'idle'} /></div>
    </div>
  );
}

// ── Auto-refresh dot ──────────────────────────────────────────────────────────

function RefreshDot({ refreshing }: { refreshing: boolean }) {
  return (
    <span style={{
      display: 'inline-block',
      width: '8px', height: '8px',
      borderRadius: '50%',
      background: theme.colors.accent,
      animation: refreshing ? 'spin 1s linear infinite' : 'pulse 2s infinite',
      transition: 'background 0.3s',
    }} />
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MonitoringPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [timeline, setTimeline] = useState<TimelineResponse | null>(null);
  const [activityEntries, setActivityEntries] = useState<ActivityEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);

  const load = () => {
    setRefreshing(true);
    Promise.all([
      listProjects(),
      getTimeline(),
      getActivityLog(100),
    ]).then(([proj, tl, act]) => {
      setProjects(proj.projects);
      setTimeline(tl);
      setActivityEntries(act.entries);
      setLastRefresh(new Date());
      setRefreshing(false);
    }).catch((e: Error) => {
      setError(e.message);
      setRefreshing(false);
    });
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 15_000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeProjects = projects?.filter((p) => p.bridge !== null) ?? [];
  const totalProjects  = projects?.length ?? 0;
  const activeCount    = activeProjects.length;

  return (
    <div style={{
      padding: '32px',
      display: 'flex',
      flexDirection: 'column',
      gap: '32px',
      animation: 'fadeIn 0.3s ease',
    }}>
      {/* Page header */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        paddingBottom: '24px',
        borderBottom: `1px solid ${theme.colors.border}`,
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
            Monitoring
          </h1>
          <p style={{ margin: `6px 0 0`, fontSize: theme.font.size.sm, color: theme.colors.muted }}>
            System-wide view of all projects and bridges
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshDot refreshing={refreshing} />
            <span style={{ fontSize: theme.font.size.xs, color: theme.colors.muted, fontFamily: theme.font.mono }}>
              {lastRefresh.toLocaleTimeString()}
            </span>
          </div>
          <button
            onClick={load}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              background: theme.colors.surfaceElevated,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radius.md,
              color: theme.colors.text,
              fontSize: theme.font.size.sm,
              fontFamily: theme.font.sans,
              cursor: 'pointer',
              transition: theme.transition.fast,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '10px 16px',
          background: theme.colors.dangerBg,
          border: `1px solid ${theme.colors.danger}44`,
          borderRadius: theme.radius.md,
          color: theme.colors.danger,
          fontSize: theme.font.size.sm,
        }}>
          Failed to load: {error}
        </div>
      )}

      {/* 1. Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
        <StatCard
          label="Total Projects"
          value={projects === null ? '…' : totalProjects}
          accent={theme.colors.accent}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>}
        />
        <StatCard
          label="Active Bridges"
          value={projects === null ? '…' : activeCount}
          sub={activeCount > 0 ? `${activeCount} running` : 'None running'}
          accent={activeCount > 0 ? theme.colors.success : theme.colors.muted}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>}
        />
        <StatCard
          label="Idle Projects"
          value={projects === null ? '…' : totalProjects - activeCount}
          accent={theme.colors.muted}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
        />
      </div>

      {/* 2. Session Timeline */}
      <Section title="Session Timeline">
        <div style={{
          background: theme.colors.surface,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.radius.lg,
          padding: '20px',
          boxShadow: theme.shadow.card,
        }}>
          {timeline ? (
            <TimelineChart projects={timeline.projects} />
          ) : (
            <div style={{ color: theme.colors.muted, fontSize: theme.font.size.sm }}>Loading timeline…</div>
          )}
        </div>
      </Section>

      {/* 3. All Projects table */}
      <Section title="All Projects">
        <div style={{
          background: theme.colors.surface,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.radius.lg,
          overflow: 'hidden',
          boxShadow: theme.shadow.card,
        }}>
          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto auto auto',
            gap: '16px',
            padding: '8px 16px',
            background: theme.colors.surfaceElevated,
            borderBottom: `1px solid ${theme.colors.border}`,
          }}>
            {['Project', 'PID', 'Expires', 'Status'].map((col, i) => (
              <span key={col} style={{
                fontSize: '10px',
                color: theme.colors.muted,
                textTransform: 'uppercase' as const,
                letterSpacing: '0.1em',
                fontWeight: theme.font.weight.semibold,
                fontFamily: theme.font.sans,
                textAlign: i > 0 ? 'right' as const : 'left' as const,
              }}>
                {col}
              </span>
            ))}
          </div>

          {projects === null && (
            <div style={{ padding: '16px' }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{
                  height: '44px',
                  background: theme.colors.surfaceElevated,
                  borderRadius: theme.radius.sm,
                  marginBottom: '8px',
                  opacity: 0.4,
                  animation: 'shimmer 1.5s infinite',
                  backgroundImage: `linear-gradient(90deg, ${theme.colors.surfaceElevated} 0%, #1e1e3a 50%, ${theme.colors.surfaceElevated} 100%)`,
                  backgroundSize: '200% 100%',
                }} />
              ))}
            </div>
          )}

          {projects !== null && projects.length === 0 && (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: theme.colors.muted, fontSize: theme.font.size.sm }}>
              No projects to monitor. <Link to="/projects/new" style={{ color: theme.colors.link }}>Create one →</Link>
            </div>
          )}

          {projects !== null && projects.length > 0 && [...projects]
            .sort((a, b) => (b.bridge ? 1 : 0) - (a.bridge ? 1 : 0))
            .map((p) => <ProjectRow key={p.groupId} project={p} />)
          }
        </div>
      </Section>

      {/* 4. Activity Log */}
      <Section title="Activity Log">
        <ActivityFeed entries={activityEntries} />
      </Section>

      {/* 5. Live Event Feed */}
      <Section title="Live Events">
        <EventFeed />
      </Section>
    </div>
  );
}
