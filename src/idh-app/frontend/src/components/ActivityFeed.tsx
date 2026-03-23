import { theme } from '../theme';
import type { ActivityEntry } from '../api/types';

interface ActivityFeedProps {
  entries: ActivityEntry[];
  maxHeight?: string;
}

// Map event type to a display color
function eventTypeColor(event: string): string {
  if (event === 'session_started' || event === 'session_renewed') return theme.colors.active;
  if (event === 'warning_sent')                                    return theme.colors.warning;
  if (event === 'session_stopped' || event === 'error')            return theme.colors.danger;
  if (event === 'project_created')                                 return theme.colors.text;
  return theme.colors.textSecondary;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function ActivityFeed({ entries, maxHeight }: ActivityFeedProps) {
  if (entries.length === 0) {
    return (
      <div style={{
        padding: '24px 16px',
        textAlign: 'center',
        color: theme.colors.muted,
        fontSize: theme.fontSize.sm,
        fontFamily: theme.font.sans,
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
      background: theme.colors.surface,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.radius.lg,
      overflow: 'hidden',
      maxHeight: maxHeight ?? '320px',
      overflowY: 'auto',
    }}>
      {entries.map((e, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            gap: '12px',
            padding: '6px 0',
            borderBottom: `1px solid ${theme.colors.border}`,
            alignItems: 'center',
            paddingLeft: '14px',
            paddingRight: '14px',
          }}
        >
          {/* Timestamp */}
          <span style={{
            fontSize: theme.fontSize.xs,
            fontFamily: theme.font.mono,
            color: theme.colors.muted,
            flexShrink: 0,
          }}>
            {formatTimestamp(e.timestamp)}
          </span>

          {/* Event type */}
          <span style={{
            fontSize: theme.fontSize.sm,
            fontFamily: theme.font.sans,
            color: eventTypeColor(e.event),
            flexShrink: 0,
          }}>
            {e.event}
          </span>

          {/* Project name */}
          <span style={{
            fontSize: theme.fontSize.xs,
            fontFamily: theme.font.mono,
            color: theme.colors.textSecondary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {e.projectId}
          </span>
        </div>
      ))}
    </div>
  );
}
