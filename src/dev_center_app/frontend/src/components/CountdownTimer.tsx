// ====== Code Summary ======
// CountdownTimer — live countdown from now to expiresAt, ticking every second.

import { useState, useEffect } from 'react';
import theme from '../theme';

interface CountdownTimerProps { expiresAt: string; }

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'EXP';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

function remainingColor(ms: number): string {
  if (ms <= 0)                    return theme.colors.muted;
  if (ms < 30 * 60 * 1_000)      return theme.colors.danger;
  if (ms < 2 * 60 * 60 * 1_000)  return theme.colors.warning;
  return theme.colors.accent;
}

export default function CountdownTimer({ expiresAt }: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(() =>
    new Date(expiresAt).getTime() - Date.now()
  );

  useEffect(() => {
    setRemaining(new Date(expiresAt).getTime() - Date.now());
    const id = setInterval(() => {
      setRemaining(new Date(expiresAt).getTime() - Date.now());
    }, 1_000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return (
    <span style={{
      fontFamily: theme.font.mono,
      fontSize: theme.fontSize.sm,
      color: remainingColor(remaining),
      letterSpacing: '0.03em',
      fontVariantNumeric: 'tabular-nums',
    }}>
      {formatRemaining(remaining)}
    </span>
  );
}
