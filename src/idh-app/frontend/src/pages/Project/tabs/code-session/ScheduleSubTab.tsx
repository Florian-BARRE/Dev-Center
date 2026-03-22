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

  // 1. Load global schedule for preview / baseline when switching to custom
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
    if (globalSchedule) setConfig({ ...globalSchedule });
    setMode('custom');
  };

  const switchToInherit = () => { setMode('inherit'); };

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Mode toggle */}
      <div style={{
        display: 'flex',
        gap: '4px',
        padding: '4px',
        background: theme.colors.surfaceElevated,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.radius.lg,
        alignSelf: 'flex-start',
      }}>
        <button
          onClick={switchToInherit}
          style={{
            padding: '5px 16px',
            background: mode === 'inherit' ? theme.colors.accentDim : 'none',
            border: mode === 'inherit' ? `1px solid ${theme.colors.accent}33` : '1px solid transparent',
            borderRadius: theme.radius.md,
            color: mode === 'inherit' ? theme.colors.accent : theme.colors.muted,
            fontSize: theme.font.size.sm,
            fontFamily: theme.font.sans,
            fontWeight: mode === 'inherit' ? theme.font.weight.semibold : theme.font.weight.normal,
            cursor: 'pointer',
            transition: theme.transition.fast,
          }}
        >
          Inherit global
        </button>
        <button
          onClick={switchToCustom}
          style={{
            padding: '5px 16px',
            background: mode === 'custom' ? theme.colors.accentDim : 'none',
            border: mode === 'custom' ? `1px solid ${theme.colors.accent}33` : '1px solid transparent',
            borderRadius: theme.radius.md,
            color: mode === 'custom' ? theme.colors.accent : theme.colors.muted,
            fontSize: theme.font.size.sm,
            fontFamily: theme.font.sans,
            fontWeight: mode === 'custom' ? theme.font.weight.semibold : theme.font.weight.normal,
            cursor: 'pointer',
            transition: theme.transition.fast,
          }}
        >
          Custom schedule
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '8px 12px',
          background: theme.colors.dangerBg,
          border: `1px solid ${theme.colors.danger}44`,
          borderRadius: theme.radius.sm,
          color: theme.colors.danger,
          fontSize: theme.font.size.sm,
        }}>
          {error}
        </div>
      )}

      {/* Inherit mode: read-only preview */}
      {mode === 'inherit' && (
        <div style={{
          background: theme.colors.surface,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.radius.lg,
          padding: '16px',
          boxShadow: theme.shadow.card,
        }}>
          <div style={{
            fontSize: '10px',
            color: theme.colors.muted,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontFamily: theme.font.sans,
            fontWeight: theme.font.weight.semibold,
            marginBottom: '12px',
          }}>
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
        <div style={{
          background: theme.colors.surface,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.radius.lg,
          padding: '16px',
          boxShadow: theme.shadow.card,
        }}>
          <ScheduleEditor value={config} onChange={setConfig} />
        </div>
      )}

      {/* Save */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={save}
          disabled={saving}
          style={{
            padding: '8px 20px',
            background: saved ? theme.colors.success : theme.colors.accent,
            border: 'none',
            borderRadius: theme.radius.md,
            color: theme.colors.onPrimary,
            fontSize: theme.font.size.md,
            fontFamily: theme.font.sans,
            fontWeight: theme.font.weight.semibold,
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.6 : 1,
            transition: theme.transition.fast,
          }}
        >
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
        </button>
      </div>
    </div>
  );
}
