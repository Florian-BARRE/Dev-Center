// ====== Code Summary ======
// Monitoring — project status table + real-time events feed.

import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import theme from '../../theme';
import { getMonitoring } from '../../api/monitoring';
import EventFeed from '../../components/EventFeed';
import CountdownTimer from '../../components/CountdownTimer';
import StatusBadge from '../../components/StatusBadge';
import type { ProjectMonitorRow } from '../../api/types';

const REFRESH_INTERVAL = 10_000;

const CONTENT_STYLE: React.CSSProperties = {
  maxWidth: theme.maxWidth,
  margin: '0 auto',
  padding: `${theme.spacing['2xl']} ${theme.spacing.xl}`,
};

export default function MonitoringPage() {
  const [rows, setRows] = useState<ProjectMonitorRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await getMonitoring();
      setRows(res.projects);
    } catch { /* retain */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [load]);

  const thStyle: React.CSSProperties = {
    fontFamily: theme.font.sans,
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.muted,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    padding: '8px 12px',
    borderBottom: `1px solid ${theme.colors.border}`,
    textAlign: 'left',
  };

  const tdStyle: React.CSSProperties = {
    fontFamily: theme.font.mono,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    padding: '10px 12px',
    borderBottom: `1px solid ${theme.colors.border}`,
    verticalAlign: 'middle',
  };

  return (
    <div style={CONTENT_STYLE}>
      <h1 style={{
        fontFamily: theme.font.sans,
        fontSize: theme.fontSize.xl,
        fontWeight: theme.fontWeight.semibold,
        color: theme.colors.text,
        marginBottom: theme.spacing['2xl'],
      }}>
        Monitoring
      </h1>

      {/* Projects table */}
      <div style={{
        background: theme.colors.surface,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.radius.md,
        overflow: 'hidden',
        marginBottom: theme.spacing['2xl'],
      }}>
        {loading ? (
          <div style={{ padding: theme.spacing.xl, color: theme.colors.muted, fontFamily: theme.font.sans, fontSize: theme.fontSize.sm }}>
            Loading…
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Project</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>PID</th>
                <th style={thStyle}>TTL</th>
                <th style={thStyle}>Workspace</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ ...tdStyle, color: theme.colors.muted, textAlign: 'center', fontFamily: theme.font.sans }}>
                    No projects
                  </td>
                </tr>
              ) : rows.map((row) => (
                <tr key={row.id}>
                  <td style={tdStyle}>
                    <Link to={`/projects/${row.id}`} style={{ color: theme.colors.text, textDecoration: 'none', fontFamily: theme.font.sans, fontWeight: theme.fontWeight.medium }}>
                      {row.name}
                    </Link>
                  </td>
                  <td style={tdStyle}>
                    <StatusBadge status={row.status === 'active' ? 'active' : row.status === 'cloning' ? 'cloning' : 'idle'} />
                  </td>
                  <td style={tdStyle}>{row.pid ?? '—'}</td>
                  <td style={tdStyle}>
                    {row.expiresAt ? <CountdownTimer expiresAt={row.expiresAt} /> : '—'}
                  </td>
                  <td style={{ ...tdStyle, color: theme.colors.muted, fontSize: theme.fontSize.xs, maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.workspacePath}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Real-time events */}
      <EventFeed />
    </div>
  );
}
