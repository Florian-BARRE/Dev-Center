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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{
        fontSize: '10px',
        fontFamily: theme.font.sans,
        fontWeight: theme.font.weight.semibold,
        color: theme.colors.muted,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        marginBottom: '3px',
      }}>
        {label}
      </div>
      <div style={{ fontFamily: theme.font.mono, fontSize: theme.font.size.sm, color: theme.colors.text }}>
        {value}
      </div>
    </div>
  );
}

export default function ConfirmStep({
  repoUrl, provider, model, groupId, onGroupIdChange, onBack, onConfirm, loading, error
}: ConfirmStepProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Summary */}
      <div style={{
        background: theme.colors.surfaceElevated,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.radius.md,
        padding: '14px',
      }}>
        <InfoRow label="Repository" value={repoUrl} />
        <InfoRow label="Model" value={`${provider} / ${model}`} />
      </div>

      {/* Group ID input */}
      <div>
        <label style={{
          display: 'block',
          fontSize: '10px',
          fontFamily: theme.font.sans,
          fontWeight: theme.font.weight.semibold,
          color: theme.colors.muted,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginBottom: '6px',
        }}>
          Telegram Group ID
        </label>
        <input
          type="text"
          value={groupId}
          onChange={(e) => onGroupIdChange(e.target.value)}
          placeholder="-100123456789"
          style={{
            background: theme.colors.surfaceElevated,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.md,
            color: theme.colors.text,
            fontFamily: theme.font.mono,
            fontSize: theme.font.size.md,
            padding: '8px 12px',
            width: '100%',
            boxSizing: 'border-box',
            outline: 'none',
          }}
        />
        <div style={{ fontSize: theme.font.size.xs, color: theme.colors.muted, marginTop: '5px' }}>
          The Telegram group ID where the bot will operate for this project.
        </div>
      </div>

      {/* Error */}
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

      {/* Nav */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
        <button
          onClick={onBack}
          disabled={loading}
          style={{
            padding: '8px 20px',
            border: `1px solid ${theme.colors.borderAccent}`,
            background: 'transparent',
            color: theme.colors.text,
            borderRadius: theme.radius.md,
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: theme.font.size.md,
            fontFamily: theme.font.sans,
            opacity: loading ? 0.5 : 1,
            transition: theme.transition.fast,
          }}
        >
          ← Back
        </button>
        <button
          onClick={onConfirm}
          disabled={loading || !groupId.trim()}
          style={{
            padding: '8px 24px',
            background: loading || !groupId.trim() ? theme.colors.surfaceElevated : theme.colors.accent,
            color: loading || !groupId.trim() ? theme.colors.muted : theme.colors.onPrimary,
            border: 'none',
            borderRadius: theme.radius.md,
            cursor: loading || !groupId.trim() ? 'not-allowed' : 'pointer',
            fontSize: theme.font.size.md,
            fontFamily: theme.font.sans,
            fontWeight: theme.font.weight.semibold,
            transition: theme.transition.fast,
          }}
        >
          {loading ? 'Creating...' : 'Create Project'}
        </button>
      </div>
    </div>
  );
}
