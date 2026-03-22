import { useEffect, useState } from 'react';
import { theme } from '../../theme';
import ModelSelector from '../../components/ModelSelector';
import { getGlobalDefaults, putGlobalDefaults } from '../../api/settings';
import { MODEL_OPTIONS } from '../../api/types';
import type { GlobalDefaults } from '../../api/types';

export default function DefaultsEditor() {
  const [defaults, setDefaults] = useState<GlobalDefaults>({
    defaultProvider: MODEL_OPTIONS[0].provider,
    defaultModel: MODEL_OPTIONS[0].model,
    defaultBridgeTtlHours: 8,
    defaultTelegramPrompt: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getGlobalDefaults()
      .then(setDefaults)
      .catch((e: Error) => setError(e.message));
  }, []);

  const save = async () => {
    setSaving(true); setError(null);
    try {
      await putGlobalDefaults(defaults);
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

      {/* Default AI model */}
      <div style={{ background: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.lg, overflow: 'hidden' }}>
        <div style={{ padding: `${theme.spacing.sm} ${theme.spacing.lg}`, borderBottom: `1px solid ${theme.colors.border}`, background: theme.colors.surfaceElevated }}>
          <span style={{ fontSize: theme.font.size.sm, fontWeight: theme.font.weight.semibold, color: theme.colors.text }}>Default AI Model</span>
        </div>
        <div style={{ padding: theme.spacing.lg }}>
          <ModelSelector
            provider={defaults.defaultProvider}
            model={defaults.defaultModel}
            onChange={(p, m) => setDefaults({ ...defaults, defaultProvider: p, defaultModel: m })}
          />
        </div>
      </div>

      {/* Default bridge TTL */}
      <div style={{ background: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.lg, overflow: 'hidden' }}>
        <div style={{ padding: `${theme.spacing.sm} ${theme.spacing.lg}`, borderBottom: `1px solid ${theme.colors.border}`, background: theme.colors.surfaceElevated }}>
          <span style={{ fontSize: theme.font.size.sm, fontWeight: theme.font.weight.semibold, color: theme.colors.text }}>Default Bridge TTL</span>
        </div>
        <div style={{ padding: theme.spacing.lg }}>
          <label style={{ fontSize: theme.font.size.sm, color: theme.colors.text }}>
            <strong>{defaults.defaultBridgeTtlHours}</strong> hours
            <input
              type="range" min={1} max={24} step={1}
              value={defaults.defaultBridgeTtlHours}
              onChange={(e) => setDefaults({ ...defaults, defaultBridgeTtlHours: Number(e.target.value) })}
              style={{ display: 'block', width: '100%', marginTop: '8px', accentColor: theme.colors.primary }}
            />
          </label>
        </div>
      </div>

      {/* Default Telegram prompt */}
      <div style={{ background: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.lg, overflow: 'hidden' }}>
        <div style={{ padding: `${theme.spacing.sm} ${theme.spacing.lg}`, borderBottom: `1px solid ${theme.colors.border}`, background: theme.colors.surfaceElevated }}>
          <span style={{ fontSize: theme.font.size.sm, fontWeight: theme.font.weight.semibold, color: theme.colors.text }}>Default Telegram System Prompt</span>
        </div>
        <div style={{ padding: theme.spacing.lg }}>
          <textarea
            value={defaults.defaultTelegramPrompt}
            onChange={(e) => setDefaults({ ...defaults, defaultTelegramPrompt: e.target.value })}
            rows={6}
            style={{
              width: '100%', background: theme.colors.bg, border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radius.md, color: theme.colors.text, fontFamily: theme.font.mono,
              fontSize: theme.font.size.sm, padding: theme.spacing.md, resize: 'vertical',
              boxSizing: 'border-box', outline: 'none', lineHeight: 1.6,
            }}
          />
        </div>
      </div>

      {/* Save */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={save} disabled={saving} style={{
          padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
          background: saved ? theme.colors.success : theme.colors.primary,
          border: 'none', borderRadius: theme.radius.md, color: theme.colors.onPrimary,
          fontSize: theme.font.size.sm, fontWeight: theme.font.weight.semibold,
          cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
          transition: theme.transition.fast,
        }}>
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Defaults'}
        </button>
      </div>
    </div>
  );
}
