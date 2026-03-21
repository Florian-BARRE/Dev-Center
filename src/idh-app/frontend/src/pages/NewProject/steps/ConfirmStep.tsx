import { theme } from '../../../theme';

interface ConfirmStepProps {
  repoUrl: string;
  provider: string;
  model: string;
  groupId: string;
  onGroupIdChange: (id: string) => void;
  onBack: () => void;
  onConfirm: () => void;
  loading: boolean;
  error: string | null;
}

export default function ConfirmStep({
  repoUrl, provider, model, groupId, onGroupIdChange, onBack, onConfirm, loading, error
}: ConfirmStepProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
      <div style={{ background: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, padding: theme.spacing.md }}>
        <div style={{ marginBottom: theme.spacing.xs, color: theme.colors.muted, fontSize: theme.font.size.xs }}>REPOSITORY</div>
        <div style={{ fontFamily: theme.font.mono, color: theme.colors.text }}>{repoUrl}</div>
        <div style={{ marginTop: theme.spacing.sm, marginBottom: theme.spacing.xs, color: theme.colors.muted, fontSize: theme.font.size.xs }}>MODEL</div>
        <div style={{ fontFamily: theme.font.mono, color: theme.colors.text }}>{provider} / {model}</div>
      </div>

      <div>
        <label style={{ display: 'block', color: theme.colors.muted, fontSize: theme.font.size.xs, marginBottom: theme.spacing.xs }}>
          TELEGRAM GROUP ID
        </label>
        <input
          type="text"
          value={groupId}
          onChange={(e) => onGroupIdChange(e.target.value)}
          placeholder="-100123456789"
          style={{
            background: theme.colors.surface,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.md,
            color: theme.colors.text,
            fontFamily: theme.font.mono,
            fontSize: theme.font.size.md,
            padding: `${theme.spacing.sm} ${theme.spacing.md}`,
            width: '100%',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ fontSize: theme.font.size.xs, color: theme.colors.muted, marginTop: theme.spacing.xs }}>
          The Telegram group ID where the bot will operate for this project.
        </div>
      </div>

      {error && <div style={{ color: theme.colors.danger, fontSize: theme.font.size.md }}>{error}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button
          onClick={onBack}
          disabled={loading}
          style={{
            padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
            border: `1px solid ${theme.colors.border}`,
            background: 'transparent',
            color: theme.colors.text,
            borderRadius: theme.radius.md,
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: theme.font.size.md,
          }}
        >
          ← Back
        </button>
        <button
          onClick={onConfirm}
          disabled={loading || !groupId.trim()}
          style={{
            padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
            background: theme.colors.primary,
            color: theme.colors.onPrimary,
            border: 'none',
            borderRadius: theme.radius.md,
            cursor: loading || !groupId.trim() ? 'not-allowed' : 'pointer',
            fontSize: theme.font.size.md,
            fontWeight: 600,
          }}
        >
          {loading ? 'Creating...' : 'Create Project'}
        </button>
      </div>
    </div>
  );
}
