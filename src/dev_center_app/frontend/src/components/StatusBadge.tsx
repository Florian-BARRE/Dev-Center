// ====== Code Summary ======
// StatusBadge — compact inline status indicator with LED dot.
// Monospaced, operational style. Used in project headers and monitoring.

import theme from '../theme';

type Status = 'active' | 'idle' | 'cloning' | 'error';

const STATUS_CONFIG: Record<Status, { label: string; color: string; pulse: boolean }> = {
  active:  { label: 'LIVE',   color: theme.colors.active,  pulse: true  },
  idle:    { label: 'IDLE',   color: theme.colors.muted,   pulse: false },
  cloning: { label: 'CLONE',  color: theme.colors.warning, pulse: true  },
  error:   { label: 'ERR',    color: theme.colors.danger,  pulse: false },
};

interface StatusBadgeProps { status: Status; }

export default function StatusBadge({ status }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '2px 7px',
      borderRadius: theme.radius.sm,
      fontSize: '10px',
      fontWeight: theme.fontWeight.bold,
      fontFamily: theme.font.display,
      color: cfg.color,
      background: cfg.color + '12',
      border: `1px solid ${cfg.color}30`,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      boxShadow: status === 'active' ? `0 0 8px ${theme.colors.active}25` : 'none',
    }}>
      <span style={{
        width: '4px', height: '4px', borderRadius: '50%',
        background: cfg.color, display: 'inline-block', flexShrink: 0,
        boxShadow: status === 'active' ? `0 0 5px ${cfg.color}` : 'none',
        animation: cfg.pulse ? 'pulse-dot 2s infinite' : 'none',
      }} />
      {cfg.label}
    </span>
  );
}
