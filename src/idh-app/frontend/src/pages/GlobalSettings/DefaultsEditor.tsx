import { useEffect, useState } from 'react';
import { theme } from '../../theme';
import ModelSelector from '../../components/ModelSelector';
import { getGlobalDefaults, putGlobalDefaults } from '../../api/settings';
import { MODEL_OPTIONS } from '../../api/types';
import type { GlobalDefaults } from '../../api/types';

// ── Section card ──────────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: theme.colors.surface,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.radius.lg,
      overflow: 'hidden',
      boxShadow: theme.shadow.card,
    }}>
      <div style={{
        padding: '8px 16px',
        borderBottom: `1px solid ${theme.colors.border}`,
        background: theme.colors.surfaceElevated,
      }}>
        <span style={{
          fontSize: theme.font.size.sm,
          fontFamily: theme.font.sans,
          fontWeight: theme.font.weight.semibold,
          color: theme.colors.text,
        }}>
          {title}
        </span>
      </div>
      <div style={{ padding: '16px' }}>{children}</div>
    </div>
  );
}

// ── DefaultsEditor ────────────────────────────────────────────────────────────

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '640px' }}>
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

      {/* Default AI model */}
      <SectionCard title="Default AI Model">
        <ModelSelector
          provider={defaults.defaultProvider}
          model={defaults.defaultModel}
          onChange={(p, m) => setDefaults({ ...defaults, defaultProvider: p, defaultModel: m })}
        />
      </SectionCard>

      {/* Default bridge TTL */}
      <SectionCard title="Default Bridge TTL">
        <label style={{ fontSize: theme.font.size.sm, color: theme.colors.text, display: 'block' }}>
          <span style={{ fontFamily: theme.font.mono, color: theme.colors.accent, fontWeight: theme.font.weight.semibold }}>
            {defaults.defaultBridgeTtlHours}
          </span>
          <span style={{ color: theme.colors.muted }}> hours</span>
          <input
            type="range" min={1} max={24} step={1}
            value={defaults.defaultBridgeTtlHours}
            onChange={(e) => setDefaults({ ...defaults, defaultBridgeTtlHours: Number(e.target.value) })}
            style={{ display: 'block', width: '100%', marginTop: '10px', accentColor: theme.colors.accent }}
          />
        </label>
      </SectionCard>

      {/* Default Telegram prompt */}
      <SectionCard title="Default Telegram System Prompt">
        <textarea
          value={defaults.defaultTelegramPrompt}
          onChange={(e) => setDefaults({ ...defaults, defaultTelegramPrompt: e.target.value })}
          rows={6}
          style={{
            width: '100%',
            background: theme.colors.bg,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.md,
            color: theme.colors.text,
            fontFamily: theme.font.mono,
            fontSize: theme.font.size.sm,
            padding: '10px 12px',
            resize: 'vertical',
            boxSizing: 'border-box',
            outline: 'none',
            lineHeight: 1.6,
          }}
        />
      </SectionCard>

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
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Defaults'}
        </button>
      </div>
    </div>
  );
}
