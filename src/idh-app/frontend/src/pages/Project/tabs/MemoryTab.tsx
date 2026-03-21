import { useEffect, useRef, useState } from 'react';
import { theme } from '../../../theme';
import MarkdownEditor from '../../../components/MarkdownEditor';
import { getSessionMemory, putSessionMemory, getTranscript } from '../../../api/memory';
import type { Project } from '../../../api/types';

const TRANSPARENT_BG = 'none' as const;
const NO_BORDER = 'none' as const;
const EDITOR_MIN_HEIGHT = '400px';
const TRANSCRIPT_PANEL_HEIGHT = '450px';

type SubTab = 'memory' | 'transcript';

interface MemoryTabProps {
  project: Project;
}

export default function MemoryTab({ project }: MemoryTabProps) {
  const [subTab, setSubTab] = useState<SubTab>('memory');
  const [content, setContent] = useState('');
  const [transcript, setTranscript] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getSessionMemory(project.projectId)
      .then((r) => setContent(r.content))
      .catch(() => setContent(''));
    getTranscript(project.projectId)
      .then((r) => setTranscript(r.content))
      .catch(() => setTranscript('(No transcript available)'));
  }, [project.projectId]);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await putSessionMemory(project.projectId, content);
      setSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
      {/* Sub-tab navigation */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${theme.colors.border}` }}>
        <button
          onClick={() => setSubTab('memory')}
          style={{
            background: TRANSPARENT_BG,
            border: NO_BORDER,
            color: subTab === 'memory' ? theme.colors.text : theme.colors.muted,
            fontFamily: theme.font.mono,
            fontSize: theme.font.size.sm,
            cursor: 'pointer',
            padding: `${theme.spacing.xs} ${theme.spacing.md}`,
            borderBottom: subTab === 'memory' ? `2px solid ${theme.colors.primary}` : '2px solid transparent',
          }}
        >
          SESSION_MEMORY.md
        </button>
        <button
          onClick={() => setSubTab('transcript')}
          style={{
            background: TRANSPARENT_BG,
            border: NO_BORDER,
            color: subTab === 'transcript' ? theme.colors.text : theme.colors.muted,
            fontFamily: theme.font.mono,
            fontSize: theme.font.size.sm,
            cursor: 'pointer',
            padding: `${theme.spacing.xs} ${theme.spacing.md}`,
            borderBottom: subTab === 'transcript' ? `2px solid ${theme.colors.primary}` : '2px solid transparent',
          }}
        >
          Transcript
        </button>
      </div>

      {error && (
        <div style={{ color: theme.colors.danger, fontSize: theme.font.size.sm }}>{error}</div>
      )}

      {/* SESSION_MEMORY.md editor */}
      {subTab === 'memory' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: `${theme.spacing.xs} ${theme.spacing.md}`,
                background: saved ? theme.colors.primary : theme.colors.surface,
                color: saved ? theme.colors.onPrimary : theme.colors.text,
                border: `1px solid ${saved ? theme.colors.primary : theme.colors.border}`,
                borderRadius: theme.radius.md,
                cursor: saving ? 'not-allowed' : 'pointer',
                fontSize: theme.font.size.sm,
              }}
            >
              {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save'}
            </button>
          </div>
          <MarkdownEditor value={content} onChange={setContent} minHeight={EDITOR_MIN_HEIGHT} />
        </>
      )}

      {/* Transcript viewer */}
      {subTab === 'transcript' && (
        <div
          style={{
            background: theme.colors.terminalBg,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.md,
            padding: theme.spacing.md,
            height: TRANSCRIPT_PANEL_HEIGHT,
            overflowY: 'auto',
            fontFamily: theme.font.mono,
            fontSize: theme.font.size.xs,
            color: theme.colors.muted,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {transcript || '(No transcript)'}
        </div>
      )}
    </div>
  );
}
