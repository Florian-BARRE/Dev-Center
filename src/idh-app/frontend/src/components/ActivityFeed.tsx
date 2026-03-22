import { theme } from '../theme';
import type { ActivityEntry } from '../api/types';

interface ActivityFeedProps {
  entries: ActivityEntry[];
}

function levelColor(level: ActivityEntry['level']): string {
  if (level === 'warning') return theme.colors.warning;
  if (level === 'error')   return theme.colors.danger;
  return theme.colors.muted;
}

function levelDot(level: ActivityEntry['level']): string {
  if (level === 'warning') return theme.colors.warning;
  if (level === 'error')   return theme.colors.danger;
  return theme.colors.success;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function ActivityFeed({ entries }: ActivityFeedProps) {
  if (entries.length === 0) {
    return (
      <div style={{
        padding: '24px 16px',
        textAlign: 'center',
        color: theme.colors.muted,
        fontSize: theme.font.size.sm,
        background: theme.colors.surface,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.radius.lg,
      }}>
        No activity recorded yet.
      </div>
    );
  }

  return (
    <div style={{
      background: theme.colors.terminalBg,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.radius.lg,
      overflow: 'hidden',
      maxHeight: '320px',
      overflowY: 'auto',
      boxShadow: theme.shadow.card,
    }}>
      {entries.map((e, i) => (
        <div
          key={i}
          style={{
            display: 'grid',
            gridTemplateColumns: '80px 12px 120px 1fr',
            gap: '10px',
            padding: '6px 14px',
            borderBottom: i < entries.length - 1 ? `1px solid ${theme.colors.border}22` : 'none',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: theme.font.size.xs, fontFamily: theme.font.mono, color: `${theme.colors.muted}88` }}>
            {formatTimestamp(e.timestamp)}
          </span>
          <span style={{
            width: '5px', height: '5px', borderRadius: '50%',
            background: levelDot(e.level), display: 'inline-block', flexShrink: 0,
          }} />
          <span style={{
            fontSize: theme.font.size.xs,
            color: theme.colors.textSecondary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontFamily: theme.font.mono,
          }}>
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
