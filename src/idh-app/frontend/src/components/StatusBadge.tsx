import { theme } from '../theme';

type Status = 'active' | 'idle' | 'warning';

const STATUS_CONFIG: Record<Status, { label: string; color: string; bg: string }> = {
  active:  { label: 'Active',  color: theme.colors.primary,  bg: '#0d2818' },
  idle:    { label: 'Idle',    color: theme.colors.muted,    bg: theme.colors.surface },
  warning: { label: 'Warning', color: theme.colors.warning,  bg: '#2d1e00' },
};

interface StatusBadgeProps {
  status: Status;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      style={{
        display: 'inline-block',
        padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
        borderRadius: theme.radius.sm,
        fontSize: theme.font.size.xs,
        fontWeight: 600,
        fontFamily: theme.font.mono,
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.color}40`,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}
    >
      {cfg.label}
    </span>
  );
}
