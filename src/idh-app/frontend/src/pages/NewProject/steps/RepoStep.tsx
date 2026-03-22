import { theme } from '../../../theme';

interface RepoStepProps {
  repoUrl: string;
  onChange: (url: string) => void;
  onNext: () => void;
}

export default function RepoStep({ repoUrl, onChange, onNext }: RepoStepProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <p style={{ color: theme.colors.muted, margin: 0, fontSize: theme.font.size.md }}>
        Enter the SSH or HTTPS URL of the Git repository to clone.
      </p>
      <input
        type="text"
        value={repoUrl}
        onChange={(e) => onChange(e.target.value)}
        placeholder="git@github.com:user/repo.git"
        style={{
          background: theme.colors.surfaceElevated,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.radius.md,
          color: theme.colors.text,
          fontFamily: theme.font.mono,
          fontSize: theme.font.size.md,
          padding: '10px 12px',
          width: '100%',
          boxSizing: 'border-box',
          outline: 'none',
        }}
        autoFocus
      />
      <button
        onClick={onNext}
        disabled={!repoUrl.trim()}
        style={{
          alignSelf: 'flex-end',
          padding: '8px 24px',
          background: repoUrl.trim() ? theme.colors.accent : theme.colors.surfaceElevated,
          color: repoUrl.trim() ? theme.colors.onPrimary : theme.colors.muted,
          border: repoUrl.trim() ? 'none' : `1px solid ${theme.colors.border}`,
          borderRadius: theme.radius.md,
          cursor: repoUrl.trim() ? 'pointer' : 'not-allowed',
          fontSize: theme.font.size.md,
          fontFamily: theme.font.sans,
          fontWeight: theme.font.weight.semibold,
          transition: theme.transition.fast,
        }}
      >
        Next →
      </button>
    </div>
  );
}
