import { theme } from '../theme';
import type { TimelineProject } from '../api/types';

const WINDOW_HOURS = 48;
const ROW_HEIGHT = 32;

interface TimelineChartProps {
  projects: TimelineProject[];
}

function statusColor(status: 'active' | 'scheduled' | 'past'): string {
  if (status === 'active')    return theme.colors.accent;
  if (status === 'scheduled') return `${theme.colors.accent}4D`;   // 30% opacity
  return `${theme.colors.muted}33`;                                  // 20% opacity
}

export default function TimelineChart({ projects }: TimelineChartProps) {
  if (projects.length === 0) {
    return (
      <div style={{ padding: '16px', textAlign: 'center', color: theme.colors.muted, fontSize: theme.fontSize.sm }}>
        No schedule data to display.
      </div>
    );
  }

  const now = Date.now();
  const totalMs  = WINDOW_HOURS * 60 * 60 * 1000;
  const leftEdge = now - (WINDOW_HOURS / 2) * 60 * 60 * 1000;

  return (
    <div style={{ overflowX: 'auto' }}>
      {projects.map((proj) => (
        <div key={proj.groupId} style={{
          display: 'grid',
          gridTemplateColumns: '120px 1fr',
          gap: '8px',
          alignItems: 'center',
          marginBottom: '6px',
        }}>
          {/* Project label */}
          <span style={{
            fontSize: theme.fontSize.xs,
            color: theme.colors.textSecondary,
            fontFamily: theme.font.mono,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textAlign: 'right',
            paddingRight: '8px',
          }}>
            {proj.projectId}
          </span>

          {/* Timeline row */}
          <div style={{
            position: 'relative',
            height: `${ROW_HEIGHT}px`,
            background: theme.colors.surface,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.sm,
            overflow: 'hidden',
          }}>
            {/* "now" marker */}
            <div style={{
              position: 'absolute',
              left: '50%',
              top: 0,
              bottom: 0,
              width: '1px',
              background: `${theme.colors.warning}88`,
              zIndex: 2,
            }} />

            {/* Window blocks */}
            {proj.windows.map((win, i) => {
              const startMs = new Date(win.start).getTime();
              const endMs   = new Date(win.end).getTime();
              let left  = ((startMs - leftEdge) / totalMs) * 100;
              let width = ((endMs - startMs) / totalMs) * 100;

              // Clamp to visible area
              if (left + width < 0 || left > 100) return null;
              if (left < 0) { width += left; left = 0; }
              if (left + width > 100) { width = 100 - left; }

              return (
                <div key={i} style={{
                  position: 'absolute',
                  left: `${left}%`,
                  width: `${width}%`,
                  top: '4px',
                  bottom: '4px',
                  background: statusColor(win.status),
                  borderRadius: '2px',
                  transition: 'background 0.2s',
                  boxShadow: win.status === 'active' ? `0 0 8px ${theme.colors.accent}44` : 'none',
                }} />
              );
            })}
          </div>
        </div>
      ))}

      {/* X-axis label */}
      <div style={{ paddingLeft: '128px', display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
        <span style={{ fontSize: theme.fontSize.xs, color: theme.colors.muted, fontFamily: theme.font.mono }}>-24h</span>
        <span style={{ fontSize: theme.fontSize.xs, color: theme.colors.warning, fontFamily: theme.font.mono }}>now</span>
        <span style={{ fontSize: theme.fontSize.xs, color: theme.colors.muted, fontFamily: theme.font.mono }}>+24h</span>
      </div>
    </div>
  );
}
