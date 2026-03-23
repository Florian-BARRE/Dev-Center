import { useState, useEffect } from 'react';
import { theme } from '../theme';

interface CountdownTimerProps {
  expiresAt: string;  // ISO-8601 UTC
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'Expired';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// Thresholds in milliseconds
const TWO_HOURS     = 2 * 60 * 60 * 1_000;
const THIRTY_MINS   = 30 * 60 * 1_000;

function remainingColor(ms: number): string {
  if (ms <= 0)             return theme.colors.muted;
  if (ms < THIRTY_MINS)   return theme.colors.warning;
  if (ms < TWO_HOURS)     return theme.colors.text;
  return theme.colors.textSecondary;
}

export default function CountdownTimer({ expiresAt }: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(() => new Date(expiresAt).getTime() - Date.now());

  useEffect(() => {
    // Update immediately when expiresAt changes, then tick every second
    setRemaining(new Date(expiresAt).getTime() - Date.now());
    const id = setInterval(() => {
      setRemaining(new Date(expiresAt).getTime() - Date.now());
    }, 1_000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return (
    <span
      style={{
        fontFamily: theme.font.mono,
        fontSize: theme.fontSize.base,
        color: remainingColor(remaining),
      }}
    >
      {formatRemaining(remaining)}
    </span>
  );
}
