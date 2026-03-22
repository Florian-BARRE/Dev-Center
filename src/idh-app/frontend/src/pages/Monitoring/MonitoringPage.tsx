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

// ── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps { label: string; value: string | number; sub?: string; accent?: string; icon: ReactNode; }

function StatCard({ label, value, sub, accent, icon }: StatCardProps) {
  return (
    <div style={{
      background: theme.colors.surface, border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.radius.lg, padding: theme.spacing.lg,
      display: 'flex', flexDirection: 'column', gap: theme.spacing.xs,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: theme.font.size.xs, color: theme.colors.muted, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: theme.font.weight.medium }}>{label}</span>
        <span style={{ color: accent ?? theme.colors.muted, opacity: 0.7 }}>{icon}</span>
      </div>
      <div style={{ fontSize: theme.font.size.xxxl, fontWeight: theme.font.weight.bold, color: accent ?? theme.colors.text, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: theme.font.size.xs, color: theme.colors.muted }}>{sub}</div>}
    </div>
  );
}

// ── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 style={{ margin: `0 0 ${theme.spacing.md}`, fontSize: theme.font.size.md, fontWeight: theme.font.weight.semibold, color: theme.colors.text }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

// ── Bridge row ─────────────────────────────────────────────────────────────────

function UpcomingRow({ project }: { project: Project }) {
  const isActive = project.bridge !== null;
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: theme.spacing.lg,
      alignItems: 'center', padding: `${theme.spacing.md} ${theme.spacing.lg}`,
      borderBottom: `1px solid ${theme.colors.border}`,
    }}>
      <div style={{ minWidth: 0 }}>
        <Link
          to={`/projects/${encodeURIComponent(project.groupId)}/code-session`}
          style={{ textDecoration: 'none', color: theme.colors.text, fontWeight: theme.font.weight.medium, fontSize: theme.font.size.sm }}
        >
          {project.projectId}
        </Link>
        <div style={{ fontSize: theme.font.size.xs, color: theme.colors.muted, fontFamily: theme.font.mono, marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {project.groupId}
        </div>
      </div>
      <div style={{ fontSize: theme.font.size.xs, fontFamily: theme.font.mono, color: isActive ? theme.colors.muted : `${theme.colors.muted}44`, minWidth: '80px', textAlign: 'right' }}>
        {isActive ? `PID ${project.bridge!.pid}` : '—'}
      </div>
      <div style={{ fontSize: theme.font.size.xs, fontFamily: theme.font.mono, color: isActive ? theme.colors.warning : `${theme.colors.muted}44`, minWidth: '80px', textAlign: 'right' }}>
        {isActive ? <CountdownTimer expiresAt={project.bridge!.expiresAt} /> : '—'}
      </div>
      <div><StatusBadge status={isActive ? 'active' : 'idle'} /></div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MonitoringPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [timeline, setTimeline] = useState<TimelineResponse | null>(null);
  const [activityEntries, setActivityEntries] = useState<ActivityEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const load = () => {
    Promise.all([
      listProjects(),
      getTimeline(),
      getActivityLog(100),
    ]).then(([proj, tl, act]) => {
      setProjects(proj.projects);
      setTimeline(tl);
      setActivityEntries(act.entries);
      setLastRefresh(new Date());
    }).catch((e: Error) => setError(e.message));
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
    <div style={{ padding: theme.spacing.xl, display: 'flex', flexDirection: 'column', gap: theme.spacing.xl }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: theme.font.size.xxxl, fontWeight: theme.font.weight.bold, lineHeight: 1.1 }}>Monitoring</h1>
          <p style={{ margin: `${theme.spacing.xs} 0 0`, fontSize: theme.font.size.sm, color: theme.colors.muted }}>
            System-wide view of all projects and bridges
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
          <span style={{ fontSize: theme.font.size.xs, color: theme.colors.muted, fontFamily: theme.font.mono }}>
            Last refresh: {lastRefresh.toLocaleTimeString()}
          </span>
          <button onClick={load} style={{
            display: 'inline-flex', alignItems: 'center', gap: theme.spacing.xs,
            padding: `${theme.spacing.sm} ${theme.spacing.md}`,
            background: theme.colors.surfaceElevated, border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.md, color: theme.colors.text, fontSize: theme.font.size.sm, cursor: 'pointer',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: theme.spacing.md, background: theme.colors.dangerBg, border: `1px solid ${theme.colors.danger}44`, borderRadius: theme.radius.md, color: theme.colors.danger, fontSize: theme.font.size.sm }}>
          Failed to load: {error}
        </div>
      )}

      {/* 1. Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: theme.spacing.md }}>
        <StatCard label="Total Projects" value={projects === null ? '…' : totalProjects}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>} />
        <StatCard label="Active Bridges" value={projects === null ? '…' : activeCount}
          sub={activeCount > 0 ? `${activeCount} running` : 'None running'}
          accent={activeCount > 0 ? theme.colors.success : undefined}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>} />
        <StatCard label="Idle Projects" value={projects === null ? '…' : totalProjects - activeCount}
          accent={totalProjects - activeCount > 0 ? theme.colors.muted : undefined}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>} />
      </div>

      {/* 2. Session Timeline */}
      <Section title="Session Timeline">
        <div style={{ background: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.lg, padding: theme.spacing.lg }}>
          {timeline ? (
            <TimelineChart projects={timeline.projects} />
          ) : (
            <div style={{ color: theme.colors.muted, fontSize: theme.font.size.sm }}>Loading timeline…</div>
          )}
        </div>
      </Section>

      {/* 3. All Projects */}
      <Section title="All Projects">
        <div style={{ background: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.lg, overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: theme.spacing.lg, padding: `${theme.spacing.sm} ${theme.spacing.lg}`, background: theme.colors.surfaceElevated, borderBottom: `1px solid ${theme.colors.border}` }}>
            {['Project', 'PID', 'Expires', 'Status'].map((col, i) => (
              <span key={col} style={{ fontSize: theme.font.size.xs, color: theme.colors.muted, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: theme.font.weight.medium, textAlign: i > 0 ? 'right' : 'left' }}>
                {col}
              </span>
            ))}
          </div>
          {projects === null && (
            <div style={{ padding: theme.spacing.lg }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ height: '48px', background: theme.colors.surfaceElevated, borderRadius: theme.radius.sm, marginBottom: theme.spacing.sm, opacity: 0.4 }} />
              ))}
            </div>
          )}
          {projects !== null && projects.length === 0 && (
            <div style={{ padding: `${theme.spacing.xl} ${theme.spacing.lg}`, textAlign: 'center', color: theme.colors.muted, fontSize: theme.font.size.sm }}>
              No projects to monitor. <Link to="/projects/new" style={{ color: theme.colors.link }}>Create one →</Link>
            </div>
          )}
          {projects !== null && projects.length > 0 && [...projects]
            .sort((a, b) => (b.bridge ? 1 : 0) - (a.bridge ? 1 : 0))
            .map((p) => <UpcomingRow key={p.groupId} project={p} />)
          }
        </div>
      </Section>

      {/* 4. Activity Log */}
      <Section title="Activity Log">
        <ActivityFeed entries={activityEntries} />
      </Section>
    </div>
  );
}
