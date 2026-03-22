import { useEffect, useState } from 'react';
import { theme } from '../../../../theme';
import ScheduleEditor from '../../../../components/ScheduleEditor';
import { getProjectSchedule, putProjectSchedule, getGlobalScheduling } from '../../../../api/settings';
import type { Project, ScheduleConfig } from '../../../../api/types';

const DEFAULT_SCHEDULE: ScheduleConfig = {
  enabled: false,
  windows: [],
  warnLeadMinutes: 60,
  warnIntervalMinutes: 10,
  alertTemplate: '⏰ Session ending in {remaining}. Ready to transition? [✅ Now] [⏳ +30 min] [🔄 Wait]',
};

interface ScheduleSubTabProps {
  project: Project;
}

export default function ScheduleSubTab({ project }: ScheduleSubTabProps) {
  const [mode, setMode] = useState<'inherit' | 'custom'>(project.schedule !== null ? 'custom' : 'inherit');
  const [config, setConfig] = useState<ScheduleConfig>(project.schedule ?? DEFAULT_SCHEDULE);
  const [globalSchedule, setGlobalSchedule] = useState<ScheduleConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Load global schedule (for preview in inherit mode and baseline when switching to custom)
  useEffect(() => {
    getGlobalScheduling()
      .then(setGlobalSchedule)
      .catch(() => setGlobalSchedule(null));
  }, []);

  // 2. Load per-project schedule
  useEffect(() => {
    if (project.schedule !== null) {
      getProjectSchedule(project.groupId)
        .then(setConfig)
        .catch(() => {});
    }
  }, [project.groupId, project.schedule]);

  const switchToCustom = () => {
    // Start from global schedule as baseline if available
    if (globalSchedule) setConfig({ ...globalSchedule });
    setMode('custom');
  };

  const switchToInherit = () => {
    setMode('inherit');
  };

  const save = async () => {
    setSaving(true); setError(null);
    try {
      if (mode === 'custom') {
        await putProjectSchedule(project.groupId, config);
      } else {
        await putProjectSchedule(project.groupId, null);   // null = revert to inherit
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally { setSaving(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.lg }}>
      {/* Inherit/Custom toggle */}
      <div style={{
        display: 'flex', gap: '2px',
        background: theme.colors.surface, border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.radius.md, overflow: 'hidden', alignSelf: 'flex-start',
      }}>
        <button onClick={switchToInherit} style={{
          padding: `${theme.spacing.xs} ${theme.spacing.md}`,
          background: mode === 'inherit' ? theme.colors.surfaceElevated : 'none',
          border: 'none', color: mode === 'inherit' ? theme.colors.text : theme.colors.muted,
          fontSize: theme.font.size.sm, cursor: 'pointer', transition: theme.transition.fast,
        }}>
          ○ Inherit global defaults
        </button>
        <button onClick={switchToCustom} style={{
          padding: `${theme.spacing.xs} ${theme.spacing.md}`,
          background: mode === 'custom' ? theme.colors.surfaceElevated : 'none',
          border: 'none', color: mode === 'custom' ? theme.colors.text : theme.colors.muted,
          fontSize: theme.font.size.sm, cursor: 'pointer', transition: theme.transition.fast,
        }}>
          ● Custom schedule
        </button>
      </div>

      {error && (
        <div style={{ padding: `${theme.spacing.sm} ${theme.spacing.md}`, background: theme.colors.dangerBg, border: `1px solid ${theme.colors.danger}44`, borderRadius: theme.radius.sm, color: theme.colors.danger, fontSize: theme.font.size.sm }}>
          {error}
        </div>
      )}

      {/* Inherit mode: read-only global schedule preview */}
      {mode === 'inherit' && (
        <div style={{ background: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.lg, padding: theme.spacing.lg }}>
          <div style={{ fontSize: theme.font.size.xs, color: theme.colors.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: theme.spacing.md }}>
            Global schedule (read-only preview)
          </div>
          {globalSchedule ? (
            <ScheduleEditor value={globalSchedule} onChange={() => {}} />
          ) : (
            <div style={{ color: theme.colors.muted, fontSize: theme.font.size.sm }}>Loading global schedule…</div>
          )}
        </div>
      )}

      {/* Custom mode: editable */}
      {mode === 'custom' && (
        <div style={{ background: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.lg, padding: theme.spacing.lg }}>
          <ScheduleEditor value={config} onChange={setConfig} />
        </div>
      )}

      {/* Save button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={save} disabled={saving} style={{
          padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
          background: saved ? theme.colors.success : theme.colors.primary,
          border: 'none', borderRadius: theme.radius.md,
          color: theme.colors.onPrimary, fontSize: theme.font.size.sm,
          fontWeight: theme.font.weight.semibold,
          cursor: saving ? 'not-allowed' : 'pointer',
          opacity: saving ? 0.6 : 1, transition: theme.transition.fast,
        }}>
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
        </button>
      </div>
    </div>
  );
}
