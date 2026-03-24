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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <p style={{ color: theme.colors.muted, margin: 0, fontSize: theme.fontSize.md }}>
        Choose the AI model for the Telegram coding agent.
      </p>
      <ModelSelector provider={provider} model={model} onChange={onChange} />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
        <button
          onClick={onBack}
          style={{
            padding: '8px 20px',
            border: `1px solid ${theme.colors.border}`,
            background: 'transparent',
            color: theme.colors.text,
            borderRadius: theme.radius.md,
            cursor: 'pointer',
            fontSize: theme.fontSize.md,
            fontFamily: theme.font.sans,
            transition: 'none',
          }}
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          style={{
            padding: '8px 24px',
            background: theme.colors.accent,
            color: theme.colors.bg,
            border: 'none',
            borderRadius: theme.radius.md,
            cursor: 'pointer',
            fontSize: theme.fontSize.md,
            fontFamily: theme.font.sans,
            fontWeight: theme.fontWeight.semibold,
            transition: 'none',
          }}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
