import { theme } from '../../../theme';
import ModelSelector from '../../../components/ModelSelector';

interface ModelStepProps {
  provider: string;
  model: string;
  onChange: (provider: string, model: string) => void;
  onBack: () => void;
  onNext: () => void;
}

export default function ModelStep({ provider, model, onChange, onBack, onNext }: ModelStepProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
      <p style={{ color: theme.colors.muted, margin: 0 }}>
        Choose the AI model for the Telegram coding agent.
      </p>
      <ModelSelector provider={provider} model={model} onChange={onChange} />
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button
          onClick={onBack}
          style={{
            padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
            border: `1px solid ${theme.colors.border}`,
            background: 'transparent',
            color: theme.colors.text,
            borderRadius: theme.radius.md,
            cursor: 'pointer',
            fontSize: theme.font.size.md,
          }}
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          style={{
            padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
            background: theme.colors.primary,
            color: theme.colors.onPrimary,
            border: 'none',
            borderRadius: theme.radius.md,
            cursor: 'pointer',
            fontSize: theme.font.size.md,
            fontWeight: 600,
          }}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
