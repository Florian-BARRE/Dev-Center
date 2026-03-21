import { useState } from 'react';
import { theme } from '../../theme';
import MarkdownEditor from '../../components/MarkdownEditor';
import { putGlobalCodingRules } from '../../api/settings';

interface CodingRulesEditorProps {
  initialContent: string;
}

export default function CodingRulesEditor({ initialContent }: CodingRulesEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await putGlobalCodingRules(content);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: theme.font.size.lg, fontFamily: theme.font.mono }}>
          CODING_RULES.md
        </h2>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
            background: saved ? theme.colors.primary : theme.colors.surface,
            color: saved ? theme.colors.onPrimary : theme.colors.text,
            border: `1px solid ${saved ? theme.colors.primary : theme.colors.border}`,
            borderRadius: theme.radius.md,
            cursor: saving ? 'not-allowed' : 'pointer',
            fontSize: theme.font.size.md,
          }}
        >
          {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save'}
        </button>
      </div>
      {error && <div style={{ color: theme.colors.danger, fontSize: theme.font.size.sm }}>{error}</div>}
      <MarkdownEditor value={content} onChange={setContent} minHeight="400px" />
    </div>
  );
}
