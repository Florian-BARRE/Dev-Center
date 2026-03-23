import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { theme } from '../../theme';
import { listProjects } from '../../api/projects';
import { getTimeline, getActivityLog } from '../../api/monitoring';
import type { Project, TimelineResponse, ActivityEntry } from '../../api/types';
import TimelineChart from '../../components/TimelineChart';
import ActivityFeed from '../../components/ActivityFeed';
import EventFeed from '../../components/EventFeed';

// ── Stat card ─────────────────────────────────────────────────────────────────

interface StatCardProps { label: string; value: string | number; sub?: string; accent?: string; icon: ReactNode; }

function StatCard({ label, value, sub, accent, icon }: StatCardProps) {
  const color = accent ?? theme.colors.accent;
  return (
    <div style={{
      background: theme.colors.surface,
      border: `1px solid ${theme.colors.border}`,
      borderTop: `2px solid ${color}`,
      borderRadius: theme.radius.lg,
      padding: '16px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: '14px',
      boxShadow: 'none',
    }}>
      <div style={{
        width: '38px', height: '38px',
        borderRadius: theme.radius.md,
        background: color + '18',
        border: `1px solid ${color}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: color, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{
          fontSize: '10px',
          fontFamily: theme.font.sans,
          color: theme.colors.muted,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          fontWeight: theme.font.weight.semibold,
          marginBottom: '2px',
        }}>
          {label}
        </div>
        <div style={{
          fontSize: theme.font.size.xxl,
          fontFamily: theme.font.display,
          fontWeight: theme.font.weight.bold,
          color: color,
          lineHeight: 1,
        }}>
          {value}
        </div>
        {sub && (
          <div style={{ fontSize: theme.font.size.xs, color: theme.colors.muted, marginTop: '2px' }}>{sub}</div>
        )}
      </div>
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Panel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div style={{
      background: theme.colors.surface,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.radius.lg,
      overflow: 'hidden',
      boxShadow: 'none',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        background: theme.colors.surfaceElevated,
        borderBottom: `1px solid ${theme.colors.border}`,
      }}>
        <span style={{
          fontSize: '10px',
          fontFamily: theme.font.sans,
          fontWeight: theme.font.weight.semibold,
          color: theme.colors.muted,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}>
          {title}
        </span>
        {action}
      </div>
      <div>{children}</div>
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
  const [refreshing, setRefreshing] = useState(false);

  const load = () => {
    setRefreshing(true);
    Promise.all([
      listProjects(),
      getTimeline(),
      getActivityLog(200),
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

  const activeCount = projects?.filter((p) => p.bridge !== null).length ?? 0;
  const totalCount  = projects?.length ?? 0;

  // Derive stats from activity log
  const today = new Date().toISOString().slice(0, 10);
  const todayEntries  = activityEntries.filter((e) => e.timestamp.slice(0, 10) === today);
  const warningCount  = todayEntries.filter((e) => e.level === 'warning').length;
  const errorCount    = todayEntries.filter((e) => e.level === 'error').length;

  return (
    <div style={{
      padding: '32px',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      animation: 'fadeIn 0.3s ease',
    }}>
      {/* Page header */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        paddingBottom: '20px',
        borderBottom: `1px solid ${theme.colors.border}`,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
            {/* Live pulse */}
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '2px 8px',
              background: theme.colors.successBg,
              border: `1px solid ${theme.colors.success}30`,
              borderRadius: theme.radius.full,
              fontSize: '10px',
              fontFamily: theme.font.mono,
              color: theme.colors.success,
              letterSpacing: '0.06em',
            }}>
              <span style={{
                width: '5px', height: '5px', borderRadius: '50%',
                background: theme.colors.success,
                display: 'inline-block',
                animation: 'pulse 2s infinite',
              }} />
              LIVE
            </span>
          </div>
          <p style={{ margin: '5px 0 0', fontSize: theme.font.size.sm, color: theme.colors.muted }}>
            Real-time activity, session timeline, and system events
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            fontSize: theme.font.size.xs,
            color: theme.colors.muted,
            fontFamily: theme.font.mono,
          }}>
            Updated {lastRefresh.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <button
            onClick={load}
            disabled={refreshing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              background: theme.colors.surfaceElevated,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radius.md,
              color: theme.colors.textSecondary,
              fontSize: theme.font.size.sm,
              fontFamily: theme.font.sans,
              cursor: refreshing ? 'not-allowed' : 'pointer',
              opacity: refreshing ? 0.6 : 1,
              transition: theme.transition.fast,
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }}>
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
          Failed to load monitoring data: {error}
        </div>
      )}

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
        <StatCard
          label="Active Bridges"
          value={projects === null ? '…' : activeCount}
          sub={`${totalCount} projects total`}
          accent={activeCount > 0 ? theme.colors.success : theme.colors.muted}
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>}
        />
        <StatCard
          label="Events Today"
          value={activityEntries.length === 0 ? '0' : todayEntries.length}
          sub="from activity log"
          accent={theme.colors.accent}
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
        />
        <StatCard
          label="Warnings"
          value={warningCount}
          sub="sent today"
          accent={warningCount > 0 ? theme.colors.warning : theme.colors.muted}
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
        />
        <StatCard
          label="Errors"
          value={errorCount}
          sub="in activity log"
          accent={errorCount > 0 ? theme.colors.danger : theme.colors.muted}
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
        />
      </div>

      {/* Session Timeline */}
      <Panel title="Session Timeline">
        <div style={{ padding: '20px' }}>
          {timeline ? (
            timeline.projects.length === 0 ? (
              <div style={{ color: theme.colors.muted, fontSize: theme.font.size.sm, textAlign: 'center', padding: '20px 0' }}>
                No session data available
              </div>
            ) : (
              <TimelineChart projects={timeline.projects} />
            )
          ) : (
            <div style={{
              height: '80px',
              background: `linear-gradient(90deg, ${theme.colors.surfaceElevated} 0%, #1e1e3a 50%, ${theme.colors.surfaceElevated} 100%)`,
              backgroundSize: '200% 100%',
              borderRadius: theme.radius.md,
              animation: 'shimmer 1.5s infinite',
            }} />
          )}
        </div>
      </Panel>

      {/* Two-column area: Activity Log + Live Events */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '16px', alignItems: 'start' }}>
        {/* Activity Log */}
        <Panel title={`Activity Log${activityEntries.length > 0 ? ` · ${activityEntries.length} events` : ''}`}>
          <div style={{ maxHeight: '480px', overflowY: 'auto' }}>
            {activityEntries.length === 0 && (
              <div style={{ padding: '24px 16px', color: theme.colors.muted, fontSize: theme.font.size.sm, textAlign: 'center' }}>
                No activity recorded yet
              </div>
            )}
            <ActivityFeed entries={activityEntries} />
          </div>
        </Panel>

        {/* Live Event Feed */}
        <Panel title="Live Events">
          <div style={{ padding: '12px' }}>
            <EventFeed />
          </div>
        </Panel>
      </div>
    </div>
  );
}
