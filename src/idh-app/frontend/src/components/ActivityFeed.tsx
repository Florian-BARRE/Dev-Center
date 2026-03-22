import { theme } from '../theme';
import type { ActivityEntry } from '../api/types';

interface ActivityFeedProps {
  entries: ActivityEntry[];
}

function levelColor(level: ActivityEntry['level']): string {
  if (level === 'warning') return theme.colors.warning;
  if (level === 'error') return theme.colors.danger;
  return theme.colors.muted;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function ActivityFeed({ entries }: ActivityFeedProps) {
  if (entries.length === 0) {
    return (
      <div style={{ padding: theme.spacing.lg, textAlign: 'center', color: theme.colors.muted, fontSize: theme.font.size.sm }}>
        No activity recorded yet.
      </div>
    );
  }

  return (
    <div style={{
      background: theme.colors.terminalBg,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.radius.md,
      overflow: 'hidden',
      maxHeight: '320px',
      overflowY: 'auto',
    }}>
      {entries.map((e, i) => (
        <div key={i} style={{
          display: 'grid',
          gridTemplateColumns: '80px 120px 1fr',
          gap: theme.spacing.md,
          padding: `${theme.spacing.xs} ${theme.spacing.md}`,
          borderBottom: i < entries.length - 1 ? `1px solid ${theme.colors.border}22` : 'none',
          alignItems: 'baseline',
        }}>
          <span style={{ fontSize: theme.font.size.xs, fontFamily: theme.font.mono, color: theme.colors.muted }}>
            {formatTimestamp(e.timestamp)}
          </span>
          <span style={{ fontSize: theme.font.size.xs, color: theme.colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {e.projectId}
          </span>
          <span style={{ fontSize: theme.font.size.xs, color: levelColor(e.level) }}>
            {e.event}
          </span>
        </div>
      ))}
    </div>
  );
}
