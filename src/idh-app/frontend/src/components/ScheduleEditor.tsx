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
    padding: '4px 8px',
    outline: 'none',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

      {/* Enabled toggle */}
      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
        <input
          type="checkbox"
          aria-label="Schedule enabled"
          checked={value.enabled}
          onChange={(e) => onChange({ ...value, enabled: e.target.checked })}
        />
        <span style={{ fontSize: theme.font.size.sm, color: theme.colors.text, fontFamily: theme.font.sans }}>
          Schedule enabled
        </span>
      </label>

      {/* Window list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {value.windows.map((win, idx) => (
          <div key={idx} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
            padding: '10px',
            background: theme.colors.surfaceElevated,
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
            <div style={{ display: 'flex', gap: '3px', marginLeft: '4px' }}>
              {DAYS.map((day) => (
                <button
                  key={day}
                  onClick={() => toggleDay(idx, day)}
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: theme.radius.sm,
                    border: `1px solid ${win.days.includes(day) ? theme.colors.accent : theme.colors.border}`,
                    background: win.days.includes(day) ? theme.colors.accentDim : 'none',
                    color: win.days.includes(day) ? theme.colors.accent : theme.colors.muted,
                    fontSize: theme.font.size.xs,
                    fontFamily: theme.font.mono,
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
                fontSize: '18px',
                lineHeight: 1,
                padding: '2px 4px',
                transition: theme.transition.fast,
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
          gap: '6px',
          padding: '5px 14px',
          background: 'none',
          border: `1px dashed ${theme.colors.border}`,
          borderRadius: theme.radius.md,
          color: theme.colors.muted,
          fontSize: theme.font.size.sm,
          fontFamily: theme.font.sans,
          cursor: 'pointer',
          transition: theme.transition.fast,
        }}
      >
        + Add window
      </button>

      {/* Warning sliders */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <label style={{ fontSize: theme.font.size.sm, color: theme.colors.text, fontFamily: theme.font.sans }}>
          Warn me{' '}
          <span style={{ fontFamily: theme.font.mono, color: theme.colors.accent, fontWeight: theme.font.weight.semibold }}>
            {value.warnLeadMinutes}
          </span>
          {' '}min before end
          <input
            type="range"
            min={15} max={180} step={15}
            value={value.warnLeadMinutes}
            onChange={(e) => onChange({ ...value, warnLeadMinutes: Number(e.target.value) })}
            style={{ display: 'block', width: '100%', marginTop: '6px', accentColor: theme.colors.accent }}
          />
        </label>
        <label style={{ fontSize: theme.font.size.sm, color: theme.colors.text, fontFamily: theme.font.sans }}>
          Repeat every{' '}
          <span style={{ fontFamily: theme.font.mono, color: theme.colors.accent, fontWeight: theme.font.weight.semibold }}>
            {value.warnIntervalMinutes}
          </span>
          {' '}min
          <input
            type="range"
            min={5} max={60} step={5}
            value={value.warnIntervalMinutes}
            onChange={(e) => onChange({ ...value, warnIntervalMinutes: Number(e.target.value) })}
            style={{ display: 'block', width: '100%', marginTop: '6px', accentColor: theme.colors.accent }}
          />
        </label>
      </div>

      {/* Alert template */}
      <div>
        <label style={{
          fontSize: '10px',
          color: theme.colors.muted,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          fontFamily: theme.font.sans,
          fontWeight: theme.font.weight.semibold,
          display: 'block',
          marginBottom: '5px',
        }}>
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
            padding: '8px 10px',
            resize: 'vertical',
            boxSizing: 'border-box',
            outline: 'none',
          }}
        />
      </div>
    </div>
  );
}
