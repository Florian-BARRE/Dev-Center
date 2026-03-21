import { theme } from '../../../theme';

interface RepoStepProps {
  repoUrl: string;
  onChange: (url: string) => void;
  onNext: () => void;
}

export default function RepoStep({ repoUrl, onChange, onNext }: RepoStepProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
      <p style={{ color: theme.colors.muted, margin: 0 }}>
        Enter the SSH or HTTPS URL of the Git repository to clone.
      </p>
      <input
        type="text"
        value={repoUrl}
        onChange={(e) => onChange(e.target.value)}
        placeholder="git@github.com:user/repo.git"
        style={{
          background: theme.colors.surface,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.radius.md,
          color: theme.colors.text,
          fontFamily: theme.font.mono,
          fontSize: theme.font.size.md,
          padding: theme.spacing.md,
          width: '100%',
          boxSizing: 'border-box',
        }}
      />
      <button
        onClick={onNext}
        disabled={!repoUrl.trim()}
        style={{
          alignSelf: 'flex-end',
          padding: `${theme.spacing.sm} ${theme.spacing.xl}`,
          background: theme.colors.primary,
          color: theme.colors.onPrimary,
          border: 'none',
          borderRadius: theme.radius.md,
          cursor: repoUrl.trim() ? 'pointer' : 'not-allowed',
          fontSize: theme.font.size.md,
          fontWeight: 600,
        }}
      >
        Next →
      </button>
    </div>
  );
}
