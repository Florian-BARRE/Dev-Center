import { theme } from '../theme';

type Status = 'active' | 'idle' | 'warning';

const STATUS_CONFIG: Record<Status, { label: string; color: string; bg: string; pulse: boolean }> = {
  active:  { label: 'Active',  color: theme.colors.success, bg: theme.colors.successBg, pulse: true },
  idle:    { label: 'Idle',    color: theme.colors.muted,   bg: theme.colors.surfaceElevated, pulse: false },
  warning: { label: 'Warning', color: theme.colors.warning, bg: theme.colors.warningBg, pulse: false },
};

interface StatusBadgeProps {
  status: Status;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '2px 8px',
        borderRadius: theme.radius.sm,
        fontSize: '10px',
        fontWeight: theme.font.weight.semibold,
        fontFamily: theme.font.mono,
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.color}40`,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
      }}
    >
      <span style={{
        width: '5px', height: '5px', borderRadius: '50%',
        background: cfg.color, display: 'inline-block', flexShrink: 0,
        animation: cfg.pulse ? 'pulse 2s infinite' : 'none',
      }} />
      {cfg.label}
    </span>
  );
}
