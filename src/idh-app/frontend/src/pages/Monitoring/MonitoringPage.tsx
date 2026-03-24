import { useEffect, useState, useCallback } from 'react';
import { theme } from '../../theme';
import { listProjects } from '../../api/projects';
import { getActivityLog } from '../../api/monitoring';
import type { Project, ActivityEntry } from '../../api/types';
import ActivityFeed from '../../components/ActivityFeed';
import EventFeed from '../../components/EventFeed';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns how many seconds have elapsed since `date`. */
function secondsAgo(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / 1000);
}

/** Formats elapsed seconds as a human-readable "X seconds ago" string. */
function formatLastUpdated(date: Date): string {
  const secs = secondsAgo(date);
  if (secs < 5) return 'just now';
  if (secs < 60) return `${secs} seconds ago`;
  const mins = Math.floor(secs / 60);
  return `${mins} minute${mins !== 1 ? 's' : ''} ago`;
}

// ── Stats chip ────────────────────────────────────────────────────────────────

interface StatChipProps {
  label: string;
  color: string;
}

function StatChip({ label, color }: StatChipProps) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
      background: `${color}18`,
      border: `1px solid ${color}44`,
      borderRadius: theme.radius.full,
      color: color,
      fontSize: theme.fontSize.xs,
      fontFamily: theme.font.sans,
      fontWeight: theme.fontWeight.semibold,
      letterSpacing: '0.04em',
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

// ── Select dropdown style ─────────────────────────────────────────────────────

const selectStyle: React.CSSProperties = {
  background: theme.colors.surface,
  border: `1px solid ${theme.colors.border}`,
  borderRadius: theme.radius.sm,
  color: theme.colors.text,
  fontSize: theme.fontSize.sm,
  padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
  cursor: 'pointer',
  outline: 'none',
  fontFamily: theme.font.sans,
};

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MonitoringPage() {
  const [projects, setProjects]           = useState<Project[] | null>(null);
  const [activity, setActivity]           = useState<ActivityEntry[]>([]);
  const [lastUpdated, setLastUpdated]     = useState<Date>(new Date());
  const [nowTick, setNowTick]             = useState<number>(0);
  const [projectFilter, setProjectFilter] = useState<string>('');
  const [eventFilter, setEventFilter]     = useState<string>('');

  // 1. Load both data sources in parallel on mount and every 30 seconds.
  const load = useCallback(() => {
    Promise.all([listProjects(), getActivityLog(200)]).then(([proj, act]) => {
      setProjects(proj);
      setActivity(act);
      setLastUpdated(new Date());
    }).catch(() => {
      // Silently swallow errors — the page shows stale data rather than crashing.
    });
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  // 2. Tick every second to keep the "Updated X seconds ago" display fresh.
  useEffect(() => {
    const tick = setInterval(() => setNowTick((n) => n + 1), 1000);
    return () => clearInterval(tick);
  }, []);

  // 3. Derive stats from loaded data.
  const today        = new Date().toISOString().slice(0, 10);
  const activeCount  = projects?.filter((p) => p.bridge !== null).length ?? 0;
  const todayEntries = activity.filter((e) => e.timestamp.slice(0, 10) === today);
  const warnCount    = todayEntries.filter(
    (e) => e.event === 'warning_sent' || e.level === 'warning',
  ).length;
  const errorCount   = todayEntries.filter(
    (e) => e.event === 'session_stopped' || e.level === 'error',
  ).length;

  // 4. Collect unique project IDs for the filter dropdown.
  const projectIds = Array.from(new Set(activity.map((e) => e.projectId))).sort();

  // 5. Collect unique event types for the event-type filter dropdown.
  const eventTypes = Array.from(new Set(activity.map((e) => e.event))).sort();

  // 6. Apply client-side filters to the activity entries.
  const filteredActivity = activity.filter((e) => {
    if (projectFilter && e.projectId !== projectFilter) return false;
    if (eventFilter && e.event !== eventFilter) return false;
    return true;
  });

  // Suppress the nowTick lint warning — it is used only to trigger re-render.
  void nowTick;

  return (
    <div style={{
      padding: theme.spacing['2xl'],
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing.xl,
    }}>

      {/* ── Header row ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: theme.spacing.xl,
        borderBottom: `1px solid ${theme.colors.border}`,
      }}>
        {/* Title + LIVE badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
          <h1 style={{
            margin: 0,
            fontFamily: theme.font.sans,
            fontWeight: theme.fontWeight.semibold,
            fontSize: theme.fontSize.xl,
            color: theme.colors.text,
            letterSpacing: '-0.01em',
          }}>
            MONITORING
          </h1>
          {/* Pulsing LIVE indicator */}
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: theme.spacing.xs,
            padding: `2px ${theme.spacing.sm}`,
            background: `${theme.colors.active}18`,
            border: `1px solid ${theme.colors.active}44`,
            borderRadius: theme.radius.full,
            fontSize: theme.fontSize.xs,
            fontFamily: theme.font.mono,
            color: theme.colors.active,
            letterSpacing: '0.08em',
          }}>
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: theme.colors.active,
              display: 'inline-block',
              animation: 'pulse 2s infinite',
            }} />
            LIVE
          </span>
        </div>

        {/* Timestamp + Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
          <span style={{
            fontSize: theme.fontSize.xs,
            fontFamily: theme.font.mono,
            color: theme.colors.muted,
          }}>
            Updated {formatLastUpdated(lastUpdated)}
          </span>
          <button
            onClick={load}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: theme.spacing.xs,
              padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
              background: 'none',
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radius.md,
              color: theme.colors.textSecondary,
              fontSize: theme.fontSize.sm,
              fontFamily: theme.font.sans,
              cursor: 'pointer',
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: theme.spacing.sm,
      }}>
        <StatChip
          label={`${projects === null ? '…' : activeCount} active`}
          color={theme.colors.active}
        />
        <StatChip
          label={`${todayEntries.length} events today`}
          color={theme.colors.textSecondary}
        />
        <StatChip
          label={`${warnCount} warnings`}
          color={theme.colors.warning}
        />
        <StatChip
          label={`${errorCount} errors`}
          color={theme.colors.danger}
        />
      </div>

      {/* ── 2-column grid: Live Events | Activity Log ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: theme.spacing.lg,
        alignItems: 'start',
      }}>

        {/* Left — Live Events */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: theme.spacing.sm,
        }}>
          {/* Section header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing.sm,
            paddingBottom: theme.spacing.xs,
            borderBottom: `1px solid ${theme.colors.border}`,
          }}>
            <span style={{
              fontSize: theme.fontSize.xs,
              fontFamily: theme.font.sans,
              fontWeight: theme.fontWeight.semibold,
              color: theme.colors.muted,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}>
              LIVE EVENTS
            </span>
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: theme.colors.active,
              display: 'inline-block',
              animation: 'pulse 2s infinite',
            }} />
          </div>

          {/* EventFeed manages its own WebSocket connection */}
          <EventFeed />
        </div>

        {/* Right — Activity Log */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: theme.spacing.sm,
        }}>
          {/* Section header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: theme.spacing.xs,
            borderBottom: `1px solid ${theme.colors.border}`,
          }}>
            <span style={{
              fontSize: theme.fontSize.xs,
              fontFamily: theme.font.sans,
              fontWeight: theme.fontWeight.semibold,
              color: theme.colors.muted,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}>
              ACTIVITY LOG
              {activity.length > 0 && (
                <span style={{ marginLeft: theme.spacing.sm, color: theme.colors.muted }}>
                  · {filteredActivity.length}
                </span>
              )}
            </span>
          </div>

          {/* Filter bar */}
          <div style={{
            display: 'flex',
            gap: theme.spacing.sm,
            flexWrap: 'wrap',
          }}>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              style={selectStyle}
            >
              <option value="">All projects</option>
              {projectIds.map((id) => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              style={selectStyle}
            >
              <option value="">All events</option>
              {eventTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Activity entries or empty state */}
          {filteredActivity.length === 0 ? (
            <div style={{
              padding: `${theme.spacing.xl} ${theme.spacing.lg}`,
              textAlign: 'center',
              color: theme.colors.muted,
              fontSize: theme.fontSize.sm,
              fontFamily: theme.font.sans,
              background: theme.colors.surface,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radius.lg,
            }}>
              No activity recorded
            </div>
          ) : (
            <ActivityFeed entries={filteredActivity} maxHeight="calc(100vh - 320px)" />
          )}
        </div>
      </div>
    </div>
  );
}
