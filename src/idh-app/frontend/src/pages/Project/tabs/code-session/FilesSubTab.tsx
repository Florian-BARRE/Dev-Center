import { useEffect, useState } from 'react';
import { theme } from '../../../../theme';
import MarkdownEditor from '../../../../components/MarkdownEditor';
import { getClaudeMd, putClaudeMd } from '../../../../api/settings';
import type { Project } from '../../../../api/types';

interface FilesSubTabProps {
  project: Project;
}

function computeDiff(original: string, current: string): { added: number; removed: number } | null {
  if (original === current) return null;
  const origLines = original.split('\n');
  const currLines = current.split('\n');
  const added   = Math.max(0, currLines.length - origLines.length);
  const removed = Math.max(0, origLines.length - currLines.length);
  return { added, removed };
}

export default function FilesSubTab({ project }: FilesSubTabProps) {
  const [claudeMd, setClaudeMd] = useState('');
  const [savedClaudeMd, setSavedClaudeMd] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getClaudeMd(project.groupId)
      .then((r) => { setClaudeMd(r.content); setSavedClaudeMd(r.content); })
      .catch((e: Error) => setError(e.message));
  }, [project.groupId]);

  const save = async () => {
    setSaving(true); setError(null);
    try {
      await putClaudeMd(project.groupId, claudeMd);
      setSavedClaudeMd(claudeMd);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally { setSaving(false); }
  };

  const diff = computeDiff(savedClaudeMd, claudeMd);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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

      <div style={{
        background: theme.colors.surface,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.radius.lg,
        overflow: 'hidden',
        boxShadow: theme.shadow.card,
      }}>
        {/* Card header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          borderBottom: `1px solid ${theme.colors.border}`,
          background: theme.colors.surfaceElevated,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              fontSize: theme.font.size.sm,
              fontFamily: theme.font.mono,
              fontWeight: theme.font.weight.medium,
              color: theme.colors.text,
            }}>
              CLAUDE.md
            </span>
            {diff && (
              <span style={{
                padding: '1px 6px',
                background: `${theme.colors.warning}22`,
                border: `1px solid ${theme.colors.warning}44`,
                borderRadius: theme.radius.sm,
                fontSize: theme.font.size.xs,
                fontFamily: theme.font.mono,
                color: theme.colors.warning,
              }}>
                +{diff.added} / −{diff.removed}
              </span>
            )}
          </div>
          <button
            onClick={save}
            disabled={saving}
            style={{
              padding: '4px 12px',
              background: saving ? theme.colors.surfaceElevated : theme.colors.accent,
              border: saving ? `1px solid ${theme.colors.border}` : 'none',
              borderRadius: theme.radius.md,
              color: saving ? theme.colors.text : theme.colors.onPrimary,
              cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: theme.font.size.sm,
              fontFamily: theme.font.sans,
              fontWeight: theme.font.weight.medium,
              transition: theme.transition.fast,
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>

        {/* Editor */}
        <div style={{ padding: '16px' }}>
          <MarkdownEditor value={claudeMd} onChange={setClaudeMd} minHeight="400px" />
        </div>
      </div>
    </div>
  );
}
