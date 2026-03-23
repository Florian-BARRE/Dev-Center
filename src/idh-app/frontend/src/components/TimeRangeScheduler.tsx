// ====== Code Summary ======
// TimeRangeScheduler — simplified schedule editor.
// User enters active time ranges (start → end) and active days.
// The backend handles all session start/stop/warning logic.

import React from 'react';
import theme from '../theme';

export interface TimeRange {
  start: string;  // "08:00"
  end: string;    // "00:00" = midnight
}

export interface ScheduleValue {
  enabled: boolean;
  ranges: TimeRange[];
  days: string[];
}

interface Props {
  value: ScheduleValue;
  onChange: (updated: ScheduleValue) => void;
  disabled?: boolean;
}

const DAYS = [
  { key: 'mon', label: 'L' },
  { key: 'tue', label: 'M' },
  { key: 'wed', label: 'M' },
  { key: 'thu', label: 'J' },
  { key: 'fri', label: 'V' },
  { key: 'sat', label: 'S' },
  { key: 'sun', label: 'D' },
];

const MAX_RANGES = 3;

export function TimeRangeScheduler({ value, onChange, disabled }: Props) {
  const toggleDay = (day: string) => {
    const days = value.days.includes(day)
      ? value.days.filter(d => d !== day)
      : [...value.days, day];
    onChange({ ...value, days });
  };

  const addRange = () => {
    if (value.ranges.length >= MAX_RANGES) return;
    onChange({ ...value, ranges: [...value.ranges, { start: '09:00', end: '18:00' }] });
  };

  const updateRange = (index: number, field: 'start' | 'end', val: string) => {
    const ranges = value.ranges.map((r, i) =>
      i === index ? { ...r, [field]: val } : r
    );
    onChange({ ...value, ranges });
  };

  const removeRange = (index: number) => {
    onChange({ ...value, ranges: value.ranges.filter((_, i) => i !== index) });
  };

  const rowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  };

  const inputStyle: React.CSSProperties = {
    fontFamily: theme.font.mono,
    fontSize: theme.fontSize.sm,
    background: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.sm,
    color: theme.colors.text,
    padding: '4px 8px',
    width: '80px',
  };

  const dayBtnStyle = (active: boolean): React.CSSProperties => ({
    fontFamily: theme.font.sans,
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.medium,
    width: '28px', height: '28px',
    border: `1px solid ${active ? theme.colors.text : theme.colors.border}`,
    borderRadius: theme.radius.sm,
    background: active ? theme.colors.borderStrong : 'transparent',
    color: active ? theme.colors.text : theme.colors.muted,
    cursor: 'pointer',
  });

  return (
    <div style={{ opacity: disabled ? 0.5 : 1 }}>
      {/* Time ranges */}
      <div style={{ marginBottom: theme.spacing.lg }}>
        {value.ranges.map((range, i) => (
          <div key={i} style={rowStyle}>
            <input
              type="time" value={range.start} style={inputStyle}
              onChange={e => updateRange(i, 'start', e.target.value)}
              disabled={disabled}
            />
            <span style={{ color: theme.colors.muted, fontSize: theme.fontSize.sm }}>→</span>
            <input
              type="time" value={range.end} style={inputStyle}
              onChange={e => updateRange(i, 'end', e.target.value)}
              disabled={disabled}
            />
            <button
              title="Supprimer cette plage"
              onClick={() => removeRange(i)}
              disabled={disabled}
              style={{
                background: 'none', border: 'none',
                color: theme.colors.muted, cursor: 'pointer',
                fontSize: theme.fontSize.md, padding: '0 4px',
              }}
            >×</button>
          </div>
        ))}
        {value.ranges.length < MAX_RANGES && (
          <button
            onClick={addRange} disabled={disabled}
            style={{
              fontFamily: theme.font.sans,
              fontSize: theme.fontSize.sm,
              color: theme.colors.textSecondary,
              background: 'none',
              border: `1px dashed ${theme.colors.border}`,
              borderRadius: theme.radius.sm,
              padding: '6px 12px',
              cursor: 'pointer',
              width: '100%',
            }}
          >
            + Ajouter une plage
          </button>
        )}
      </div>

      {/* Active days */}
      <div>
        <div style={{
          fontFamily: theme.font.sans, fontSize: theme.fontSize.xs,
          color: theme.colors.muted, marginBottom: theme.spacing.sm,
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          Jours actifs {value.days.length === 0 && '(tous)'}
        </div>
        <div style={{ display: 'flex', gap: theme.spacing.xs }}>
          {DAYS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => toggleDay(key)}
              disabled={disabled}
              style={dayBtnStyle(value.days.length === 0 || value.days.includes(key))}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
