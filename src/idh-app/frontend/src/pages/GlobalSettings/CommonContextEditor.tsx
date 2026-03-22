import { useState } from 'react';
import { theme } from '../../theme';
import MarkdownEditor from '../../components/MarkdownEditor';
import { putGlobalCommonContext } from '../../api/settings';

interface CommonContextEditorProps {
  initialContent: string;
}

export default function CommonContextEditor({ initialContent }: CommonContextEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await putGlobalCommonContext(content);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{
          margin: 0,
          fontSize: theme.font.size.md,
          fontFamily: theme.font.mono,
          color: theme.colors.textSecondary,
          fontWeight: theme.font.weight.medium,
        }}>
          COMMON_CONTEXT.md
        </h2>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '6px 16px',
            background: saved ? theme.colors.success : theme.colors.accent,
            color: theme.colors.onPrimary,
            border: 'none',
            borderRadius: theme.radius.md,
            cursor: saving ? 'not-allowed' : 'pointer',
            fontSize: theme.font.size.sm,
            fontFamily: theme.font.sans,
            fontWeight: theme.font.weight.semibold,
            opacity: saving ? 0.6 : 1,
            transition: theme.transition.fast,
          }}
        >
          {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save'}
        </button>
      </div>
      {error && (
        <div style={{ color: theme.colors.danger, fontSize: theme.font.size.sm }}>
          {error}
        </div>
      )}
      <MarkdownEditor value={content} onChange={setContent} minHeight="400px" />
    </div>
  );
}
