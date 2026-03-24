import { useEffect, useRef, useState } from 'react';
import { theme } from '../../../theme';
import ModelSelector from '../../../components/ModelSelector';
import {
  getTelegramModel,
  putTelegramModel,
  getTelegramPrompt,
  putTelegramPrompt,
} from '../../../api/settings';
import { MODEL_OPTIONS } from '../../../api/types';

// ── Props ─────────────────────────────────────────────────────────────────────

interface TelegramTabProps {
  groupId: string;
}

// ── Card save state ────────────────────────────────────────────────────────────

interface CardState {
  saving: boolean;
  saved: boolean;
  error: string | null;
}

const IDLE_STATE: CardState = { saving: false, saved: false, error: null };

// ── Card wrapper ──────────────────────────────────────────────────────────────

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

// ── TelegramTab ───────────────────────────────────────────────────────────────

export default function TelegramTab({ groupId }: TelegramTabProps) {
  // Model card state
  const [provider, setProvider] = useState(MODEL_OPTIONS[0].provider);
  const [model, setModel] = useState(MODEL_OPTIONS[0].model);
  const [modelCard, setModelCard] = useState<CardState>(IDLE_STATE);
  const modelSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Prompt card state
  const [agentId, setAgentId] = useState('');
  const [promptText, setPromptText] = useState('');
  const [promptCard, setPromptCard] = useState<CardState>(IDLE_STATE);
  const promptSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load initial data on mount
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getTelegramModel(groupId),
      getTelegramPrompt(groupId),
    ]).then(([m, t]) => {
      if (cancelled) return;
      if (m.provider) {
        setProvider(m.provider);
        setModel(m.model);
      }
      setAgentId(t.agentId);
      setPromptText(t.systemPrompt);
    }).catch(() => {
      // Non-critical — fields remain at defaults
    });
    return () => { cancelled = true; };
  }, [groupId]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (modelSavedTimer.current) clearTimeout(modelSavedTimer.current);
      if (promptSavedTimer.current) clearTimeout(promptSavedTimer.current);
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
      await putTelegramModel(groupId, provider, model);
      flashSaved(setModelCard, modelSavedTimer);
    } catch (e) {
      setModelCard({ saving: false, saved: false, error: e instanceof Error ? e.message : 'Failed to save' });
    }
  };

  const savePrompt = async () => {
    setPromptCard({ saving: true, saved: false, error: null });
    try {
      await putTelegramPrompt(groupId, agentId, promptText);
      flashSaved(setPromptCard, promptSavedTimer);
    } catch (e) {
      setPromptCard({ saving: false, saved: false, error: e instanceof Error ? e.message : 'Failed to save' });
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

      {/* Card 2 — Custom Prompt */}
      <div style={cardStyle}>
        <div style={cardTitleStyle}>Custom Prompt</div>
        <textarea
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          disabled={promptCard.saving}
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
            onClick={savePrompt}
            disabled={promptCard.saving}
            style={saveButtonStyle(promptCard.saving)}
          >
            {promptCard.saving ? 'Saving…' : 'Save'}
          </button>
        </div>
        {promptCard.saved && <div style={savedStyle}>Saved ✓</div>}
        {promptCard.error && <div style={errorStyle}>{promptCard.error}</div>}
      </div>
    </div>
  );
}
