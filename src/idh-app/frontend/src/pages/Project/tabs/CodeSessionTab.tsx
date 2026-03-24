import { useEffect, useRef, useState } from 'react';
import { theme } from '../../../theme';
import ModelSelector from '../../../components/ModelSelector';
import { TimeRangeScheduler } from '../../../components/TimeRangeScheduler';
import type { ScheduleValue } from '../../../components/TimeRangeScheduler';
import {
  getModel,
  putModel,
  getClaudeMd,
  putClaudeMd,
  getProjectSchedule,
  putProjectSchedule,
} from '../../../api/settings';
import type { ScheduleConfig } from '../../../api/types';
import { MODEL_OPTIONS } from '../../../api/types';

// ── Props ─────────────────────────────────────────────────────────────────────

interface CodeSessionTabProps {
  groupId: string;
}

// ── Card save state ────────────────────────────────────────────────────────────

interface CardState {
  saving: boolean;
  saved: boolean;
  error: string | null;
}

const IDLE_STATE: CardState = { saving: false, saved: false, error: null };

// ── ScheduleConfig ↔ ScheduleValue mappers ───────────────────────────────────

/**
 * Convert a ScheduleConfig (backend) into the ScheduleValue format used by
 * TimeRangeScheduler. The shapes are identical so conversion is trivial.
 */
function scheduleConfigToValue(config: ScheduleConfig): ScheduleValue {
  return {
    enabled: config.enabled,
    ranges: config.ranges ?? [],
    days: config.days ?? [],
  };
}

/**
 * Convert a ScheduleValue (from TimeRangeScheduler) back into a ScheduleConfig
 * for the backend. The shapes are identical so conversion is trivial.
 */
function scheduleValueToConfig(value: ScheduleValue): ScheduleConfig {
  return {
    enabled: value.enabled,
    ranges: value.ranges,
    days: value.days,
  };
}

// ── Shared styles ─────────────────────────────────────────────────────────────

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

const saveButtonStyle = (disabled: boolean): React.CSSProperties => ({
  background: theme.colors.accent,
  color: theme.colors.bg,
  fontFamily: theme.font.sans,
  fontWeight: theme.fontWeight.medium,
  fontSize: theme.fontSize.sm,
  padding: `${theme.spacing.xs} ${theme.spacing.md}`,
  border: 'none',
  borderRadius: theme.radius.sm,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.6 : 1,
  marginTop: theme.spacing.md,
});

const errorStyle: React.CSSProperties = {
  marginTop: theme.spacing.sm,
  fontSize: theme.fontSize.xs,
  fontFamily: theme.font.sans,
  color: theme.colors.danger,
};

const savedStyle: React.CSSProperties = {
  marginTop: theme.spacing.sm,
  fontSize: theme.fontSize.xs,
  fontFamily: theme.font.sans,
  color: theme.colors.active,
};

// ── Default schedule value when none is loaded ────────────────────────────────

const DEFAULT_SCHEDULE: ScheduleValue = { enabled: false, ranges: [], days: [] };

// ── CodeSessionTab ────────────────────────────────────────────────────────────

export default function CodeSessionTab({ groupId }: CodeSessionTabProps) {
  // Model card state
  const [provider, setProvider] = useState(MODEL_OPTIONS[0].provider);
  const [model, setModel] = useState(MODEL_OPTIONS[0].model);
  const [modelCard, setModelCard] = useState<CardState>(IDLE_STATE);
  const modelSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Schedule card state
  const [schedule, setSchedule] = useState<ScheduleValue>(DEFAULT_SCHEDULE);
  const [scheduleCard, setScheduleCard] = useState<CardState>(IDLE_STATE);
  const scheduleSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // CLAUDE.md card state
  const [claudeMd, setClaudeMd] = useState('');
  const [claudeMdCard, setClaudeMdCard] = useState<CardState>(IDLE_STATE);
  const claudeMdSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load all data on mount
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getModel(groupId),
      getProjectSchedule(groupId).catch(() => null),
      getClaudeMd(groupId).catch(() => ({ content: '' })),
    ]).then(([m, s, c]) => {
      if (cancelled) return;
      if (m.provider) {
        setProvider(m.provider);
        setModel(m.model);
      }
      if (s) {
        setSchedule(scheduleConfigToValue(s));
      }
      setClaudeMd(c.content);
    }).catch(() => {
      // Non-critical — fields remain at defaults
    });
    return () => { cancelled = true; };
  }, [groupId]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (modelSavedTimer.current) clearTimeout(modelSavedTimer.current);
      if (scheduleSavedTimer.current) clearTimeout(scheduleSavedTimer.current);
      if (claudeMdSavedTimer.current) clearTimeout(claudeMdSavedTimer.current);
    };
  }, []);

  const flashSaved = (
    setCard: React.Dispatch<React.SetStateAction<CardState>>,
    timerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>,
  ) => {
    setCard({ saving: false, saved: true, error: null });
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setCard(IDLE_STATE);
    }, 1500);
  };

  const saveModel = async () => {
    setModelCard({ saving: true, saved: false, error: null });
    try {
      await putModel(groupId, provider, model);
      flashSaved(setModelCard, modelSavedTimer);
    } catch (e) {
      setModelCard({ saving: false, saved: false, error: e instanceof Error ? e.message : 'Failed to save' });
    }
  };

  const saveSchedule = async () => {
    setScheduleCard({ saving: true, saved: false, error: null });
    try {
      // Convert the current ScheduleValue back to a ScheduleConfig for the backend.
      const config = scheduleValueToConfig(schedule);
      await putProjectSchedule(groupId, config);
      flashSaved(setScheduleCard, scheduleSavedTimer);
    } catch (e) {
      setScheduleCard({ saving: false, saved: false, error: e instanceof Error ? e.message : 'Failed to save' });
    }
  };

  const saveClaudeMd = async () => {
    setClaudeMdCard({ saving: true, saved: false, error: null });
    try {
      await putClaudeMd(groupId, claudeMd);
      flashSaved(setClaudeMdCard, claudeMdSavedTimer);
    } catch (e) {
      setClaudeMdCard({ saving: false, saved: false, error: e instanceof Error ? e.message : 'Failed to save' });
    }
  };

  return (
    <div>
      {/* Card 1 — Model */}
      <div style={cardStyle}>
        <div style={cardTitleStyle}>Model</div>
        <ModelSelector
          provider={provider}
          model={model}
          onChange={(p, m) => { setProvider(p); setModel(m); }}
          disabled={modelCard.saving}
        />
        <div>
          <button
            onClick={saveModel}
            disabled={modelCard.saving}
            style={saveButtonStyle(modelCard.saving)}
          >
            {modelCard.saving ? 'Saving…' : 'Save'}
          </button>
        </div>
        {modelCard.saved && <div style={savedStyle}>Saved ✓</div>}
        {modelCard.error && <div style={errorStyle}>{modelCard.error}</div>}
      </div>

      {/* Card 2 — Active Time Ranges */}
      <div style={cardStyle}>
        <div style={cardTitleStyle}>Active Time Ranges</div>
        <TimeRangeScheduler
          value={schedule}
          onChange={setSchedule}
          disabled={scheduleCard.saving}
        />
        <div>
          <button
            onClick={saveSchedule}
            disabled={scheduleCard.saving}
            style={saveButtonStyle(scheduleCard.saving)}
          >
            {scheduleCard.saving ? 'Saving…' : 'Save'}
          </button>
        </div>
        {scheduleCard.saved && <div style={savedStyle}>Saved ✓</div>}
        {scheduleCard.error && <div style={errorStyle}>{scheduleCard.error}</div>}
      </div>

      {/* Card 3 — CLAUDE.md Rules */}
      <div style={cardStyle}>
        <div style={cardTitleStyle}>CLAUDE.md Rules</div>
        <textarea
          value={claudeMd}
          onChange={(e) => setClaudeMd(e.target.value)}
          disabled={claudeMdCard.saving}
          style={{
            width: '100%',
            minHeight: '200px',
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
            lineHeight: 1.6,
          }}
        />
        <div>
          <button
            onClick={saveClaudeMd}
            disabled={claudeMdCard.saving}
            style={saveButtonStyle(claudeMdCard.saving)}
          >
            {claudeMdCard.saving ? 'Saving…' : 'Save'}
          </button>
        </div>
        {claudeMdCard.saved && <div style={savedStyle}>Saved ✓</div>}
        {claudeMdCard.error && <div style={errorStyle}>{claudeMdCard.error}</div>}
      </div>
    </div>
  );
}
