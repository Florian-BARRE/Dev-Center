import { useEffect, useState } from 'react';
import { theme } from '../../theme';
import ScheduleEditor from '../../components/ScheduleEditor';
import { getGlobalScheduling, putGlobalScheduling } from '../../api/settings';
import type { ScheduleConfig } from '../../api/types';

const DEFAULT_CONFIG: ScheduleConfig = {
  enabled: false,
  windows: [],
  warnLeadMinutes: 60,
  warnIntervalMinutes: 10,
  alertTemplate: '⏰ Session ending in {remaining}. Ready to transition? [✅ Now] [⏳ +30 min] [🔄 Wait]',
};

export default function SchedulingEditor() {
  const [config, setConfig] = useState<ScheduleConfig>(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getGlobalScheduling()
      .then(setConfig)
      .catch((e: Error) => setError(e.message));
  }, []);

  const save = async () => {
    setSaving(true); setError(null);
    try {
      await putGlobalScheduling(config);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally { setSaving(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.lg, maxWidth: '640px' }}>
      {error && (
        <div style={{ padding: `${theme.spacing.sm} ${theme.spacing.md}`, background: theme.colors.dangerBg, border: `1px solid ${theme.colors.danger}44`, borderRadius: theme.radius.sm, color: theme.colors.danger, fontSize: theme.font.size.sm }}>
          {error}
        </div>
      )}

      <div style={{ background: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.lg, padding: theme.spacing.lg }}>
        <ScheduleEditor value={config} onChange={setConfig} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={save} disabled={saving} style={{
          padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
          background: saved ? theme.colors.success : theme.colors.primary,
          border: 'none', borderRadius: theme.radius.md, color: '#fff',
          fontSize: theme.font.size.sm, fontWeight: theme.font.weight.semibold,
          cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
          transition: theme.transition.fast,
        }}>
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Scheduling'}
        </button>
      </div>
    </div>
  );
}
