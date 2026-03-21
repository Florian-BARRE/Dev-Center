import { theme } from '../theme';
import { MODEL_OPTIONS } from '../api/types';

interface ModelSelectorProps {
  provider: string;
  model: string;
  onChange: (provider: string, model: string) => void;
  disabled?: boolean;
}

export default function ModelSelector({ provider, model, onChange, disabled }: ModelSelectorProps) {
  const value = `${provider}|${model}`;

  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => {
        const parts = e.target.value.split('|');
        if (parts.length === 2) {
          onChange(parts[0], parts[1]);
        }
      }}
      style={{
        background: theme.colors.surface,
        color: theme.colors.text,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.radius.md,
        padding: `${theme.spacing.sm} ${theme.spacing.md}`,
        fontSize: theme.font.size.md,
        fontFamily: theme.font.mono,
        cursor: disabled ? 'not-allowed' : 'pointer',
        width: '100%',
      }}
    >
      {MODEL_OPTIONS.map((opt) => (
        <option key={`${opt.provider}|${opt.model}`} value={`${opt.provider}|${opt.model}`}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
