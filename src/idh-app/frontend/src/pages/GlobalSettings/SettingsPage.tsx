// ====== Code Summary ======
// SettingsPage — 2-tab layout (Telegram / Code Session).
// Each card manages its own load/save/error state independently.

import { useEffect, useRef, useState } from 'react';
import theme from '../../theme';
import ModelSelector from '../../components/ModelSelector';
import { TimeRangeScheduler } from '../../components/TimeRangeScheduler';
import type { ScheduleValue } from '../../components/TimeRangeScheduler';
import {
  getGlobalDefaults,
  putGlobalDefaults,
  getGlobalCommonContext,
  putGlobalCommonContext,
  getGlobalCodingRules,
  putGlobalCodingRules,
  getGlobalScheduling,
  putGlobalScheduling,
} from '../../api/settings';
import type { GlobalDefaults, ScheduleConfig } from '../../api/types';

// ── Types ─────────────────────────────────────────────────────────────────

type ActiveTab = 'telegram' | 'code';

// ── Helpers — ScheduleConfig <-> ScheduleValue bridge ─────────────────────

/** Convert a ScheduleConfig (API shape) into a ScheduleValue (TimeRangeScheduler shape). */
function scheduleConfigToValue(config: ScheduleConfig): ScheduleValue {
  // Shapes are identical — conversion is a direct field map.
  return {
    enabled: config.enabled,
    ranges: config.ranges ?? [],
    days: config.days ?? [],
  };
}

/** Convert a ScheduleValue back into a ScheduleConfig for the backend. */
function scheduleValueToConfig(value: ScheduleValue): ScheduleConfig {
  // Shapes are identical — conversion is a direct field map.
  return {
    enabled: value.enabled,
    ranges: value.ranges,
    days: value.days,
  };
}

// ── Shared card styles ─────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: theme.colors.surface,
  border: `1px solid ${theme.colors.border}`,
  borderRadius: theme.radius.md,
  padding: theme.spacing.lg,
  marginBottom: theme.spacing.xl,
};

const cardTitleStyle: React.CSSProperties = {
  fontSize: theme.fontSize.xs,
  fontFamily: theme.font.sans,
  fontWeight: theme.fontWeight.medium,
  color: theme.colors.textSecondary,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: theme.spacing.md,
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  minHeight: '160px',
  background: theme.colors.bg,
  border: `1px solid ${theme.colors.border}`,
  borderRadius: theme.radius.sm,
  color: theme.colors.text,
  fontFamily: theme.font.mono,
  fontSize: theme.fontSize.sm,
  padding: theme.spacing.md,
  resize: 'vertical',
  boxSizing: 'border-box',
  outline: 'none',
  display: 'block',
};

// ── SaveButton — shared stateful save button ───────────────────────────────

interface SaveButtonProps {
  saving: boolean;
  saved: boolean;
  error: string | null;
  onSave: () => void;
}

function SaveButton({ saving, saved, error, onSave }: SaveButtonProps) {
  return (
    <div style={{ marginTop: theme.spacing.md }}>
      {error && (
        <div style={{
          fontSize: theme.fontSize.xs,
          color: theme.colors.danger,
          marginBottom: theme.spacing.sm,
        }}>
          Failed to save: {error}
        </div>
      )}
      <button
        onClick={onSave}
        disabled={saving}
        style={{
          fontFamily: theme.font.sans,
          fontSize: theme.fontSize.sm,
          fontWeight: theme.fontWeight.medium,
          color: saved ? theme.colors.active : theme.colors.text,
          background: 'none',
          border: `1px solid ${saved ? theme.colors.active : theme.colors.border}`,
          borderRadius: theme.radius.sm,
          padding: '6px 14px',
          cursor: saving ? 'not-allowed' : 'pointer',
          opacity: saving ? 0.5 : 1,
          transition: 'color 0.2s, border-color 0.2s',
        }}
      >
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
      </button>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('telegram');

  // ── Defaults (provider + model) ──────────────────────────────────────────
  const defaultsRef = useRef<GlobalDefaults | null>(null);
  const [provider, setProvider] = useState('anthropic');
  const [model, setModel] = useState('claude-sonnet-4-6');
  const [defaultsSaving, setDefaultsSaving] = useState(false);
  const [defaultsSaved, setDefaultsSaved] = useState(false);
  const [defaultsError, setDefaultsError] = useState<string | null>(null);

  // ── Common context (shared between Telegram and Code Session tabs) ────────
  const [commonContext, setCommonContext] = useState('');
  const [ctxSaving, setCtxSaving] = useState(false);
  const [ctxSaved, setCtxSaved] = useState(false);
  const [ctxError, setCtxError] = useState<string | null>(null);

  // ── Global coding rules ───────────────────────────────────────────────────
  const [codingRules, setCodingRules] = useState('');
  const [rulesSaving, setRulesSaving] = useState(false);
  const [rulesSaved, setRulesSaved] = useState(false);
  const [rulesError, setRulesError] = useState<string | null>(null);

  // ── Global schedule ───────────────────────────────────────────────────────
  const scheduleConfigRef = useRef<ScheduleConfig | null>(null);
  const [scheduleValue, setScheduleValue] = useState<ScheduleValue>({
    enabled: false,
    ranges: [],
    days: [],
  });
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleSaved, setScheduleSaved] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // ── Loading state ─────────────────────────────────────────────────────────
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── Load all data in parallel on mount ────────────────────────────────────
  useEffect(() => {
    Promise.all([
      getGlobalDefaults(),
      getGlobalCommonContext(),
      getGlobalCodingRules(),
      getGlobalScheduling(),
    ])
      .then(([defaults, ctx, rules, schedule]) => {
        // 1. Store full defaults object for later partial updates
        defaultsRef.current = defaults;
        setProvider(defaults.defaultProvider);
        setModel(defaults.defaultModel);

        // 2. Common context content
        setCommonContext(ctx.content);

        // 3. Coding rules content
        setCodingRules(rules.content);

        // 4. Schedule — store raw config for round-trip, convert for UI
        scheduleConfigRef.current = schedule;
        setScheduleValue(scheduleConfigToValue(schedule));
      })
      .catch((e: Error) => setLoadError(e.message));
  }, []);

  // ── Flash helper ──────────────────────────────────────────────────────────
  function flashSaved(setSaved: (v: boolean) => void) {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  // ── Save handlers ─────────────────────────────────────────────────────────

  async function saveDefaults() {
    const existing = defaultsRef.current;
    if (!existing) return;
    setDefaultsSaving(true);
    setDefaultsError(null);
    try {
      // Preserve existing bridgeTtlHours and telegramPrompt; only update model.
      await putGlobalDefaults({
        ...existing,
        defaultProvider: provider,
        defaultModel: model,
      });
      defaultsRef.current = { ...existing, defaultProvider: provider, defaultModel: model };
      flashSaved(setDefaultsSaved);
    } catch (e) {
      setDefaultsError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setDefaultsSaving(false);
    }
  }

  async function saveCommonContext() {
    setCtxSaving(true);
    setCtxError(null);
    try {
      await putGlobalCommonContext(commonContext);
      flashSaved(setCtxSaved);
    } catch (e) {
      setCtxError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setCtxSaving(false);
    }
  }

  async function saveCodingRules() {
    setRulesSaving(true);
    setRulesError(null);
    try {
      await putGlobalCodingRules(codingRules);
      flashSaved(setRulesSaved);
    } catch (e) {
      setRulesError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setRulesSaving(false);
    }
  }

  async function saveSchedule() {
    setScheduleSaving(true);
    setScheduleError(null);
    try {
      const updated = scheduleValueToConfig(scheduleValue);
      await putGlobalScheduling(updated);
      scheduleConfigRef.current = updated;
      flashSaved(setScheduleSaved);
    } catch (e) {
      setScheduleError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setScheduleSaving(false);
    }
  }

  // ── Tab bar ───────────────────────────────────────────────────────────────

  const tabs: { id: ActiveTab; label: string }[] = [
    { id: 'telegram', label: 'TELEGRAM' },
    { id: 'code',     label: 'CODE SESSION' },
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{
      padding: theme.spacing['2xl'],
      maxWidth: '720px',
    }}>
      {/* Page title */}
      <h1 style={{
        margin: `0 0 ${theme.spacing.xl}`,
        fontFamily: theme.font.sans,
        fontWeight: theme.fontWeight.semibold,
        fontSize: theme.fontSize.xl,
        color: theme.colors.text,
      }}>
        SETTINGS
      </h1>

      {/* Load error */}
      {loadError && (
        <div style={{
          marginBottom: theme.spacing.xl,
          padding: `${theme.spacing.sm} ${theme.spacing.md}`,
          border: `1px solid ${theme.colors.danger}`,
          borderRadius: theme.radius.sm,
          color: theme.colors.danger,
          fontSize: theme.fontSize.sm,
          fontFamily: theme.font.sans,
        }}>
          Failed to load settings: {loadError}
        </div>
      )}

      {/* Tab bar */}
      <div style={{
        display: 'flex',
        gap: 0,
        borderBottom: `1px solid ${theme.colors.border}`,
        marginBottom: theme.spacing.xl,
      }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              fontFamily: theme.font.sans,
              fontSize: theme.fontSize.xs,
              fontWeight: theme.fontWeight.medium,
              letterSpacing: '0.06em',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === t.id
                ? `2px solid ${theme.colors.text}`
                : '2px solid transparent',
              color: activeTab === t.id ? theme.colors.text : theme.colors.muted,
              cursor: 'pointer',
              padding: `${theme.spacing.sm} ${theme.spacing.md}`,
              marginBottom: '-1px',
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TELEGRAM tab */}
      {activeTab === 'telegram' && (
        <div>
          {/* Card 1 — Default model */}
          <div style={cardStyle}>
            <div style={cardTitleStyle}>Default model</div>
            <ModelSelector
              provider={provider}
              model={model}
              onChange={(p, m) => { setProvider(p); setModel(m); }}
              disabled={defaultsSaving}
            />
            <SaveButton
              saving={defaultsSaving}
              saved={defaultsSaved}
              error={defaultsError}
              onSave={saveDefaults}
            />
          </div>

          {/* Card 2 — Default context */}
          <div style={cardStyle}>
            <div style={cardTitleStyle}>Default context</div>
            <p style={{
              margin: `0 0 ${theme.spacing.md}`,
              fontSize: theme.fontSize.xs,
              color: theme.colors.muted,
              fontFamily: theme.font.sans,
            }}>
              Default context injected into every Telegram agent prompt.
            </p>
            <textarea
              value={commonContext}
              onChange={(e) => setCommonContext(e.target.value)}
              disabled={ctxSaving}
              style={textareaStyle}
            />
            <SaveButton
              saving={ctxSaving}
              saved={ctxSaved}
              error={ctxError}
              onSave={saveCommonContext}
            />
          </div>
        </div>
      )}

      {/* CODE SESSION tab */}
      {activeTab === 'code' && (
        <div>
          {/* Card 1 — Global coding rules */}
          <div style={cardStyle}>
            <div style={cardTitleStyle}>Global coding rules</div>
            <textarea
              value={codingRules}
              onChange={(e) => setCodingRules(e.target.value)}
              disabled={rulesSaving}
              style={textareaStyle}
            />
            <SaveButton
              saving={rulesSaving}
              saved={rulesSaved}
              error={rulesError}
              onSave={saveCodingRules}
            />
          </div>

          {/* Card 2 — Common context (same endpoint as Telegram default context) */}
          <div style={cardStyle}>
            <div style={cardTitleStyle}>Common context</div>
            <p style={{
              margin: `0 0 ${theme.spacing.md}`,
              fontSize: theme.fontSize.xs,
              color: theme.colors.muted,
              fontFamily: theme.font.sans,
            }}>
              Shared context injected into all agent prompts (Telegram and code sessions).
            </p>
            <textarea
              value={commonContext}
              onChange={(e) => setCommonContext(e.target.value)}
              disabled={ctxSaving}
              style={textareaStyle}
            />
            <SaveButton
              saving={ctxSaving}
              saved={ctxSaved}
              error={ctxError}
              onSave={saveCommonContext}
            />
          </div>

          {/* Card 3 — Default schedule */}
          <div style={cardStyle}>
            <div style={cardTitleStyle}>Default schedule</div>
            <TimeRangeScheduler
              value={scheduleValue}
              onChange={setScheduleValue}
              disabled={scheduleSaving}
            />
            <SaveButton
              saving={scheduleSaving}
              saved={scheduleSaved}
              error={scheduleError}
              onSave={saveSchedule}
            />
          </div>
        </div>
      )}
    </div>
  );
}
