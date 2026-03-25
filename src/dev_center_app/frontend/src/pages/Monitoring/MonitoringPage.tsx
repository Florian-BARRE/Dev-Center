// ====== Code Summary ======
// Monitoring — dense ops table + real-time event feed.
// Designed as a live operations console: sticky header, status-colored rows, split layout.

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import theme from '../../theme';
import { getMonitoring } from '../../api/monitoring';
import EventFeed from '../../components/EventFeed';
import CountdownTimer from '../../components/CountdownTimer';
import type { ProjectMonitorRow } from '../../api/types';

const REFRESH_INTERVAL = 10_000;

// ── Helpers ──────────────────────────────────────────────────────────────────

function statusDotColor(status: string): string {
  switch (status) {
    case 'active':  return theme.colors.active;
    case 'cloning': return theme.colors.warning;
    case 'error':   return theme.colors.danger;
    default:        return theme.colors.muted;
  }
}

function statusText(status: string): string {
  switch (status) {
    case 'active':  return 'LIVE';
    case 'cloning': return 'CLONE';
    case 'error':   return 'ERR';
    default:        return 'IDLE';
  }
}

// ── Panel label ──────────────────────────────────────────────────────────────

function PanelLabel({ label, extra }: { label: string; extra?: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '6px 14px',
      background: `${theme.colors.bg}80`,
      borderBottom: `1px solid ${theme.colors.border}`,
    }}>
      <span style={{
        fontFamily: theme.font.display, fontSize: '10px',
        fontWeight: theme.fontWeight.bold, letterSpacing: '0.12em',
        color: theme.colors.textSecondary, textTransform: 'uppercase',
        display: 'flex', alignItems: 'center', gap: '6px',
      }}>
        <span style={{ color: theme.colors.accent, opacity: 0.7 }}>&gt;</span>
        {label}
      </span>
      {extra}
    </div>
  );
}

// ── Table row ────────────────────────────────────────────────────────────────

function ProjectRow({ row, idx }: { row: ProjectMonitorRow; idx: number }) {
  const [hovered, setHovered] = useState(false);
  const isActive = row.status === 'active';
  const dot      = statusDotColor(row.status);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '16px 1fr 60px 60px 80px minmax(0, 220px)',
        gap: '0 12px',
        alignItems: 'center',
        height: '36px',
        padding: '0 14px',
        borderBottom: `1px solid ${theme.colors.border}40`,
        background: hovered
          ? `${theme.colors.accent}08`
          : isActive
            ? `${theme.colors.active}04`
            : idx % 2 === 1
              ? `${theme.colors.surface}CC`
              : 'transparent',
        transition: 'background 0.12s',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Status LED */}
      <span style={{
        width: '6px', height: '6px', borderRadius: '50%',
        background: dot, display: 'inline-block',
        justifySelf: 'center',
        boxShadow: isActive ? `0 0 6px ${dot}` : 'none',
        animation: isActive ? 'pulse-dot 2.5s infinite' : 'none',
      }} />

      {/* Project name */}
      <Link to={`/projects/${row.id}`} style={{
        fontFamily: theme.font.display,
        fontSize: theme.fontSize.sm,
        fontWeight: isActive ? theme.fontWeight.semibold : theme.fontWeight.normal,
        color: hovered ? theme.colors.accent : isActive ? theme.colors.text : theme.colors.textSecondary,
        textDecoration: 'none',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        letterSpacing: '0.02em',
        transition: 'color 0.12s',
      }}>
        {row.name}
      </Link>

      {/* Status */}
      <span style={{
        fontFamily: theme.font.display, fontSize: '10px',
        fontWeight: theme.fontWeight.bold, letterSpacing: '0.08em',
        color: dot, opacity: isActive ? 1 : 0.65,
      }}>
        {statusText(row.status)}
      </span>

      {/* PID */}
      <span style={{
        fontFamily: theme.font.mono, fontSize: '11px',
        color: row.pid ? theme.colors.textSecondary : theme.colors.muted,
      }}>
        {row.pid ?? '—'}
      </span>

      {/* TTL */}
      <span style={{ fontFamily: theme.font.mono, fontSize: theme.fontSize.sm }}>
        {row.expiresAt ? <CountdownTimer expiresAt={row.expiresAt} /> : (
          <span style={{ color: theme.colors.muted }}>——</span>
        )}
      </span>

      {/* Workspace path */}
      <span style={{
        fontFamily: theme.font.mono, fontSize: '10px',
        color: theme.colors.muted,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        opacity: 0.7,
      }}>
        {row.workspacePath || '—'}
      </span>
    </div>
  );
}

// ── Column headers ───────────────────────────────────────────────────────────

function TableHeaders() {
  const col: React.CSSProperties = {
    fontFamily: theme.font.display, fontSize: '9px',
    fontWeight: theme.fontWeight.bold, letterSpacing: '0.12em',
    textTransform: 'uppercase', color: theme.colors.muted,
  };
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '16px 1fr 60px 60px 80px minmax(0, 220px)',
      gap: '0 12px',
      alignItems: 'center',
      padding: '5px 14px',
      borderBottom: `1px solid ${theme.colors.border}`,
      background: `${theme.colors.bg}60`,
      position: 'sticky', top: 0,
    }}>
      <span />
      <span style={col}>PROJECT</span>
      <span style={col}>ST</span>
      <span style={col}>PID</span>
      <span style={col}>TTL</span>
      <span style={col}>WORKSPACE</span>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function MonitoringPage() {
  const [rows, setRows]       = useState<ProjectMonitorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const load = useCallback(async () => {
    try {
      const res = await getMonitoring();
      setRows(res.projects);
      setLastRefresh(new Date());
    } catch { /* retain */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, REFRESH_INTERVAL);
    return () => clearInterval(timerRef.current);
  }, [load]);

  const activeCount = rows.filter(r => r.status === 'active').length;

  return (
    <div style={{
      maxWidth: theme.maxWidth,
      margin: '0 auto',
      padding: theme.spacing.xl,
      display: 'flex',
      flexDirection: 'column',
      gap: '0',
      animation: 'fadeUp 0.22s ease both',
    }}>

      {/* Page header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '5px 14px',
        background: `${theme.colors.surface}CC`,
        border: `1px solid ${theme.colors.border}`,
        borderBottom: 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{
            fontFamily: theme.font.display, fontSize: '11px',
            fontWeight: theme.fontWeight.bold, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: theme.colors.text,
          }}>
            Monitoring
          </span>
          {activeCount > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{
                width: '5px', height: '5px', borderRadius: '50%',
                background: theme.colors.active,
                boxShadow: `0 0 6px ${theme.colors.active}`,
                animation: 'pulse-dot 2.5s infinite',
              }} />
              <span style={{ fontFamily: theme.font.mono, fontSize: '11px', color: theme.colors.active, fontWeight: theme.fontWeight.bold }}>
                {activeCount}
              </span>
              <span style={{ fontFamily: theme.font.display, fontSize: '10px', color: theme.colors.textSecondary, letterSpacing: '0.06em' }}>
                LIVE
              </span>
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontFamily: theme.font.display, fontSize: '9px', color: theme.colors.muted, letterSpacing: '0.08em' }}>
            AUTO-REFRESH 10S
          </span>
          <span style={{ fontFamily: theme.font.mono, fontSize: '10px', color: theme.colors.muted }}>
            {lastRefresh.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
      </div>

      {/* Main split: table + event feed */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 300px',
        border: `1px solid ${theme.colors.border}`,
        background: theme.colors.surface,
        minHeight: '400px',
      }}>

        {/* Projects table */}
        <div style={{ borderRight: `1px solid ${theme.colors.border}`, display: 'flex', flexDirection: 'column' }}>
          <PanelLabel
            label={`Projects (${rows.length})`}
            extra={
              <span style={{ fontFamily: theme.font.mono, fontSize: '9px', color: loading ? theme.colors.warning : theme.colors.muted, letterSpacing: '0.06em', animation: loading ? 'pulse 1s infinite' : 'none' }}>
                {loading ? 'REFRESHING' : 'LIVE'}
              </span>
            }
          />
          <TableHeaders />

          {loading && rows.length === 0 ? (
            <div style={{ padding: '16px 14px', fontFamily: theme.font.display, fontSize: '10px', color: theme.colors.muted, letterSpacing: '0.08em', animation: 'pulse 1.5s infinite' }}>
              SCANNING…
            </div>
          ) : rows.length === 0 ? (
            <div style={{ padding: '16px 14px', fontFamily: theme.font.display, fontSize: '10px', color: theme.colors.muted, letterSpacing: '0.08em' }}>
              NO PROJECTS
            </div>
          ) : (
            rows.map((row, i) => <ProjectRow key={row.id} row={row} idx={i} />)
          )}
        </div>

        {/* Event feed */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <PanelLabel label="Event Feed" />
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <EventFeed />
          </div>
        </div>
      </div>
    </div>
  );
}
