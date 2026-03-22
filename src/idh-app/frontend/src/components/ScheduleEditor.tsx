import type React from 'react';
import { theme } from '../theme';
import type { ScheduleConfig, ScheduleWindow } from '../api/types';

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const DAY_LABELS: Record<string, string> = {
  mon: 'M', tue: 'T', wed: 'W', thu: 'T', fri: 'F', sat: 'S', sun: 'S',
};

interface ScheduleEditorProps {
  value: ScheduleConfig;
  onChange: (updated: ScheduleConfig) => void;
}

export default function ScheduleEditor({ value, onChange }: ScheduleEditorProps) {

  // ── Toggle a day on/off in a window ──────────────────────────────────────
  const toggleDay = (windowIdx: number, day: string) => {
    const windows = value.windows.map((w, i) => {
      if (i !== windowIdx) return w;
      const days = w.days.includes(day)
        ? w.days.filter((d) => d !== day)
        : [...w.days, day];
      return { ...w, days };
    });
    onChange({ ...value, windows });
  };

  // ── Update a time field in a window ──────────────────────────────────────
  const updateWindow = (idx: number, field: keyof ScheduleWindow, val: string) => {
    const windows = value.windows.map((w, i) =>
      i === idx ? { ...w, [field]: val } : w
    );
    onChange({ ...value, windows });
  };

  // ── Remove a window ───────────────────────────────────────────────────────
  const removeWindow = (idx: number) => {
    onChange({ ...value, windows: value.windows.filter((_, i) => i !== idx) });
  };

  // ── Add a new blank window ────────────────────────────────────────────────
  const addWindow = () => {
    const newWindow: ScheduleWindow = {
      startTime: '00:00',
      endTime: '08:00',
      days: [...DAYS],
    };
    onChange({ ...value, windows: [...value.windows, newWindow] });
  };

  const inputStyle: React.CSSProperties = {
    background: theme.colors.bg,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.sm,
    color: theme.colors.text,
    fontFamily: theme.font.mono,
    fontSize: theme.font.size.sm,
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    outline: 'none',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>

      {/* Enabled toggle */}
      <label style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, cursor: 'pointer' }}>
        <input
          type="checkbox"
          aria-label="Schedule enabled"
          checked={value.enabled}
          onChange={(e) => onChange({ ...value, enabled: e.target.checked })}
        />
        <span style={{ fontSize: theme.font.size.sm, color: theme.colors.text }}>
          Schedule enabled
        </span>
      </label>

      {/* Window list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
        {value.windows.map((win, idx) => (
          <div key={idx} style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing.sm,
            flexWrap: 'wrap',
            padding: theme.spacing.sm,
            background: theme.colors.surface,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.md,
          }}>
            {/* Time range */}
            <input
              type="time"
              value={win.startTime}
              onChange={(e) => updateWindow(idx, 'startTime', e.target.value)}
              style={inputStyle}
            />
            <span style={{ color: theme.colors.muted, fontSize: theme.font.size.sm }}>→</span>
            <input
              type="time"
              value={win.endTime}
              onChange={(e) => updateWindow(idx, 'endTime', e.target.value)}
              style={inputStyle}
            />

            {/* Day pills */}
            <div style={{ display: 'flex', gap: '3px', marginLeft: theme.spacing.xs }}>
              {DAYS.map((day) => (
                <button
                  key={day}
                  onClick={() => toggleDay(idx, day)}
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: theme.radius.sm,
                    border: `1px solid ${win.days.includes(day) ? theme.colors.primary : theme.colors.border}`,
                    background: win.days.includes(day) ? `${theme.colors.primary}22` : 'none',
                    color: win.days.includes(day) ? theme.colors.primary : theme.colors.muted,
                    fontSize: theme.font.size.xs,
                    fontWeight: theme.font.weight.medium,
                    cursor: 'pointer',
                    transition: theme.transition.fast,
                  }}
                >
                  {DAY_LABELS[day]}
                </button>
              ))}
            </div>

            {/* Remove button */}
            <button
              aria-label="Remove window"
              onClick={() => removeWindow(idx)}
              style={{
                marginLeft: 'auto',
                background: 'none',
                border: 'none',
                color: theme.colors.muted,
                cursor: 'pointer',
                fontSize: '16px',
                lineHeight: 1,
                padding: '2px 4px',
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Add window button */}
      <button
        aria-label="Add window"
        onClick={addWindow}
        style={{
          alignSelf: 'flex-start',
          display: 'inline-flex',
          alignItems: 'center',
          gap: theme.spacing.xs,
          padding: `${theme.spacing.xs} ${theme.spacing.md}`,
          background: 'none',
          border: `1px dashed ${theme.colors.border}`,
          borderRadius: theme.radius.md,
          color: theme.colors.muted,
          fontSize: theme.font.size.sm,
          cursor: 'pointer',
        }}
      >
        + Add window
      </button>

      {/* Warning sliders */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
        <label style={{ fontSize: theme.font.size.sm, color: theme.colors.text }}>
          Warn me <strong>{value.warnLeadMinutes}</strong> min before end
          <input
            type="range"
            min={15} max={180} step={15}
            value={value.warnLeadMinutes}
            onChange={(e) => onChange({ ...value, warnLeadMinutes: Number(e.target.value) })}
            style={{ display: 'block', width: '100%', marginTop: '4px', accentColor: theme.colors.primary }}
          />
        </label>
        <label style={{ fontSize: theme.font.size.sm, color: theme.colors.text }}>
          Repeat every <strong>{value.warnIntervalMinutes}</strong> min
          <input
            type="range"
            min={5} max={60} step={5}
            value={value.warnIntervalMinutes}
            onChange={(e) => onChange({ ...value, warnIntervalMinutes: Number(e.target.value) })}
            style={{ display: 'block', width: '100%', marginTop: '4px', accentColor: theme.colors.primary }}
          />
        </label>
      </div>

      {/* Alert template */}
      <div>
        <label style={{ fontSize: theme.font.size.xs, color: theme.colors.muted, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '4px' }}>
          Alert message template
        </label>
        <textarea
          value={value.alertTemplate}
          onChange={(e) => onChange({ ...value, alertTemplate: e.target.value })}
          rows={2}
          style={{
            width: '100%',
            background: theme.colors.bg,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.md,
            color: theme.colors.text,
            fontFamily: theme.font.mono,
            fontSize: theme.font.size.sm,
            padding: theme.spacing.sm,
            resize: 'vertical',
            boxSizing: 'border-box',
            outline: 'none',
          }}
        />
      </div>
    </div>
  );
}
