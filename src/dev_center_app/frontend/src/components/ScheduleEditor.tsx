// ====== Code Summary ======
// Schedule editor: enabled toggle, list of time ranges (HH:MM–HH:MM), days-of-week checkboxes.

import React from 'react';
import theme from '../theme';
import type { ScheduleConfig, TimeRange } from '../api/types';

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

interface ScheduleEditorProps {
  value: ScheduleConfig;
  onChange: (value: ScheduleConfig) => void;
}

export default function ScheduleEditor({ value, onChange }: ScheduleEditorProps) {
  const update = (patch: Partial<ScheduleConfig>) => onChange({ ...value, ...patch });

  const addRange = () =>
    update({ ranges: [...value.ranges, { start: '09:00', end: '18:00' }] });

  const removeRange = (i: number) =>
    update({ ranges: value.ranges.filter((_, idx) => idx !== i) });

  const updateRange = (i: number, field: keyof TimeRange, v: string) => {
    const ranges = value.ranges.map((r, idx) => idx === i ? { ...r, [field]: v } : r);
    update({ ranges });
  };

  const toggleDay = (day: string) => {
    const days = value.days.includes(day)
      ? value.days.filter((d) => d !== day)
      : [...value.days, day];
    update({ days });
  };

  const inputStyle: React.CSSProperties = {
    background: theme.colors.bg,
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.sm,
    padding: '4px 8px',
    fontSize: theme.fontSize.sm,
    fontFamily: theme.font.mono,
    width: '80px',
    outline: 'none',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
      {/* Enabled toggle */}
      <label style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(e) => update({ enabled: e.target.checked })}
        />
        <span style={{ fontFamily: theme.font.sans, fontSize: theme.fontSize.sm, color: theme.colors.text }}>
          Enable schedule
        </span>
      </label>

      {value.enabled && (
        <>
          {/* Time ranges */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
            {value.ranges.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
                <input style={inputStyle} value={r.start} onChange={(e) => updateRange(i, 'start', e.target.value)} placeholder="HH:MM" />
                <span style={{ color: theme.colors.muted, fontFamily: theme.font.sans, fontSize: theme.fontSize.sm }}>–</span>
                <input style={inputStyle} value={r.end}   onChange={(e) => updateRange(i, 'end',   e.target.value)} placeholder="HH:MM" />
                <button
                  onClick={() => removeRange(i)}
                  style={{ background: 'none', border: 'none', color: theme.colors.danger, cursor: 'pointer', fontSize: theme.fontSize.md }}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              onClick={addRange}
              style={{
                alignSelf: 'flex-start',
                background: 'none',
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.radius.sm,
                color: theme.colors.textSecondary,
                cursor: 'pointer',
                fontSize: theme.fontSize.sm,
                fontFamily: theme.font.sans,
                padding: '3px 10px',
              }}
            >
              + Add range
            </button>
          </div>

          {/* Days of week */}
          <div style={{ display: 'flex', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
            {DAYS.map((day) => {
              const active = value.days.length === 0 || value.days.includes(day);
              const explicitly = value.days.includes(day);
              return (
                <label key={day} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input
                    type="checkbox"
                    checked={explicitly || value.days.length === 0}
                    onChange={() => toggleDay(day)}
                  />
                  <span style={{
                    fontFamily: theme.font.sans,
                    fontSize: theme.fontSize.xs,
                    color: active ? theme.colors.text : theme.colors.muted,
                    textTransform: 'capitalize',
                  }}>
                    {day}
                  </span>
                </label>
              );
            })}
            {value.days.length > 0 && (
              <button
                onClick={() => update({ days: [] })}
                style={{ background: 'none', border: 'none', color: theme.colors.muted, cursor: 'pointer', fontSize: theme.fontSize.xs, fontFamily: theme.font.sans }}
              >
                all days
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
