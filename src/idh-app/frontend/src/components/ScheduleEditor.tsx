import type React from 'react';
import { theme } from '../theme';
import type { ScheduleConfig } from '../api/types';

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const DAY_LABELS: Record<string, string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
};

interface ScheduleEditorProps {
  value: ScheduleConfig;
  onChange: (updated: ScheduleConfig) => void;
}

export default function ScheduleEditor({ value, onChange }: ScheduleEditorProps) {

  // ── Renewal times ──────────────────────────────────────────────────────
  const addRenewalTime = () => {
    const times = [...value.renewalTimes, '08:00'];
    onChange({ ...value, renewalTimes: times });
  };

  const updateRenewalTime = (idx: number, val: string) => {
    const times = value.renewalTimes.map((t, i) => (i === idx ? val : t));
    onChange({ ...value, renewalTimes: times });
  };

  const removeRenewalTime = (idx: number) => {
    onChange({ ...value, renewalTimes: value.renewalTimes.filter((_, i) => i !== idx) });
  };

  // ── Days ──────────────────────────────────────────────────────────────
  const toggleDay = (day: string) => {
    const days = value.days.includes(day)
      ? value.days.filter((d) => d !== day)
      : [...value.days, day];
    onChange({ ...value, days });
  };

  const inputStyle: React.CSSProperties = {
    background: theme.colors.bg,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.sm,
    color: theme.colors.text,
    fontFamily: theme.font.mono,
    fontSize: theme.font.size.sm,
    padding: '5px 10px',
    outline: 'none',
    width: '120px',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '10px',
    color: theme.colors.muted,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    fontFamily: theme.font.sans,
    fontWeight: theme.font.weight.semibold,
    display: 'block',
    marginBottom: '8px',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

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

      {/* Renewal times */}
      <div>
        <span style={labelStyle}>Renewal times</span>
        <div style={{ fontSize: theme.font.size.xs, color: theme.colors.muted, fontFamily: theme.font.sans, marginBottom: '10px' }}>
          The bridge will auto-renew at each of these times. Warnings are sent{' '}
          <span style={{ color: theme.colors.accent, fontFamily: theme.font.mono }}>{value.warnLeadMinutes}</span> min before.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {value.renewalTimes.length === 0 && (
            <div style={{ padding: '10px 12px', background: theme.colors.surfaceElevated, borderRadius: theme.radius.md, fontSize: theme.font.size.xs, color: theme.colors.muted, fontFamily: theme.font.sans }}>
              No renewal times configured
            </div>
          )}
          {value.renewalTimes.map((t, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="time"
                value={t}
                onChange={(e) => updateRenewalTime(idx, e.target.value)}
                style={inputStyle}
              />
              <span style={{ fontSize: theme.font.size.xs, color: theme.colors.muted, fontFamily: theme.font.sans }}>
                → warns at {(() => {
                  const [hh, mm] = t.split(':').map(Number);
                  const warnMins = hh * 60 + mm - value.warnLeadMinutes;
                  const warnH = Math.floor(((warnMins % 1440) + 1440) % 1440 / 60);
                  const warnM = ((warnMins % 1440) + 1440) % 1440 % 60;
                  return `${String(warnH).padStart(2, '0')}:${String(warnM).padStart(2, '0')}`;
                })()}
              </span>
              <button
                aria-label="Remove renewal time"
                onClick={() => removeRenewalTime(idx)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: theme.colors.muted,
                  cursor: 'pointer',
                  fontSize: '16px',
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

        <button
          aria-label="Add renewal time"
          onClick={addRenewalTime}
          style={{
            marginTop: '8px',
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
          + Add time
        </button>
      </div>

      {/* Active days */}
      <div>
        <span style={labelStyle}>Active days</span>
        <div style={{ fontSize: theme.font.size.xs, color: theme.colors.muted, fontFamily: theme.font.sans, marginBottom: '10px' }}>
          {value.days.length === 0
            ? 'All days active (no restriction)'
            : `Active on: ${value.days.map((d) => DAY_LABELS[d]).join(', ')}`}
        </div>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {DAYS.map((day) => {
            const active = value.days.length === 0 || value.days.includes(day);
            const selected = value.days.includes(day);
            return (
              <button
                key={day}
                onClick={() => toggleDay(day)}
                title={value.days.length === 0 ? 'Click to restrict to specific days' : undefined}
                style={{
                  padding: '4px 10px',
                  borderRadius: theme.radius.sm,
                  border: `1px solid ${selected ? theme.colors.accent : (active ? theme.colors.borderAccent : theme.colors.border)}`,
                  background: selected ? theme.colors.accentDim : 'none',
                  color: selected ? theme.colors.accent : (active ? theme.colors.textSecondary : theme.colors.muted),
                  fontSize: theme.font.size.xs,
                  fontFamily: theme.font.mono,
                  fontWeight: theme.font.weight.medium,
                  cursor: 'pointer',
                  transition: theme.transition.fast,
                }}
              >
                {DAY_LABELS[day]}
              </button>
            );
          })}
          {value.days.length > 0 && (
            <button
              onClick={() => onChange({ ...value, days: [] })}
              style={{
                padding: '4px 10px',
                borderRadius: theme.radius.sm,
                border: `1px solid ${theme.colors.border}`,
                background: 'none',
                color: theme.colors.muted,
                fontSize: theme.font.size.xs,
                fontFamily: theme.font.sans,
                cursor: 'pointer',
              }}
            >
              All days
            </button>
          )}
        </div>
      </div>

      {/* Warning settings */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <span style={labelStyle}>Warning settings</span>
        <label style={{ fontSize: theme.font.size.sm, color: theme.colors.text, fontFamily: theme.font.sans }}>
          Warn{' '}
          <span style={{ fontFamily: theme.font.mono, color: theme.colors.accent, fontWeight: theme.font.weight.semibold }}>
            {value.warnLeadMinutes}
          </span>
          {' '}min before renewal
          <input
            type="range"
            min={5} max={120} step={5}
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
        <label style={labelStyle}>
          Alert message template
        </label>
        <div style={{ fontSize: theme.font.size.xs, color: theme.colors.muted, fontFamily: theme.font.sans, marginBottom: '8px' }}>
          Use <span style={{ fontFamily: theme.font.mono, color: theme.colors.accent }}>{'{remaining}'}</span> to insert time until renewal.
        </div>
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
