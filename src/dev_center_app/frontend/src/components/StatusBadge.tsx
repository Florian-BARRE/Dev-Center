// ====== Code Summary ======
// Badge showing session/project status with colored dot.

import theme from '../theme';

type Status = 'active' | 'idle' | 'cloning' | 'error';

const STATUS_CONFIG: Record<Status, { label: string; color: string; pulse: boolean }> = {
  active:  { label: 'ACTIVE',   color: theme.colors.active,  pulse: true  },
  idle:    { label: 'IDLE',     color: theme.colors.muted,   pulse: false },
  cloning: { label: 'CLONING',  color: theme.colors.info,    pulse: true  },
  error:   { label: 'ERROR',    color: theme.colors.danger,  pulse: false },
};

interface StatusBadgeProps {
  status: Status;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      padding: '2px 8px',
      borderRadius: theme.radius.sm,
      fontSize: theme.fontSize.xs,
      fontWeight: theme.fontWeight.medium,
      fontFamily: theme.font.sans,
      color: cfg.color,
      background: cfg.color + '1a',
      border: `1px solid ${cfg.color}33`,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    }}>
      <span style={{
        width: '5px', height: '5px', borderRadius: '50%',
        background: cfg.color, display: 'inline-block', flexShrink: 0,
        animation: cfg.pulse ? 'pulse 2s infinite' : 'none',
      }} />
      {cfg.label}
    </span>
  );
}
