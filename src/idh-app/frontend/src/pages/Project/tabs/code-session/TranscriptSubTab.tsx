import { useEffect, useState } from 'react';
import { theme } from '../../../../theme';
import { getTranscript } from '../../../../api/memory';
import type { Project } from '../../../../api/types';

type ViewMode = 'raw' | 'chat';

interface TranscriptSubTabProps {
  project: Project;
}

interface Bubble {
  role: 'human' | 'assistant' | 'other';
  text: string;
}

function parseTranscript(content: string): Bubble[] {
  const bubbles: Bubble[] = [];
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^(human|user):/i.test(trimmed)) {
      bubbles.push({ role: 'human', text: trimmed.replace(/^(human|user):\s*/i, '') });
    } else if (/^assistant:/i.test(trimmed)) {
      bubbles.push({ role: 'assistant', text: trimmed.replace(/^assistant:\s*/i, '') });
    } else {
      bubbles.push({ role: 'other', text: trimmed });
    }
  }
  return bubbles;
}

export default function TranscriptSubTab({ project }: TranscriptSubTabProps) {
  const [content, setContent] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('raw');
  const [search, setSearch] = useState('');

  useEffect(() => {
    getTranscript(project.projectId)
      .then((r) => setContent(r.content))
      .catch(() => setContent('(No transcript available)'));
  }, [project.projectId]);

  const toggleStyle = (active: boolean) => ({
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    background: active ? theme.colors.surfaceElevated : 'none',
    border: `1px solid ${active ? theme.colors.borderAccent : theme.colors.border}`,
    borderRadius: theme.radius.md,
    color: active ? theme.colors.text : theme.colors.muted,
    fontSize: theme.font.size.sm,
    cursor: 'pointer' as const,
    transition: theme.transition.fast,
  });

  const filteredContent = search
    ? content.split('\n').filter((l) => l.toLowerCase().includes(search.toLowerCase())).join('\n')
    : content;

  const bubbles = parseTranscript(viewMode === 'chat' ? filteredContent : '');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
        <button onClick={() => setViewMode('raw')} style={toggleStyle(viewMode === 'raw')}>Raw</button>
        <button onClick={() => setViewMode('chat')} style={toggleStyle(viewMode === 'chat')}>Chat</button>
        <input
          placeholder="Search transcript…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            marginLeft: 'auto', width: '200px',
            background: theme.colors.bg, border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.md, color: theme.colors.text,
            fontSize: theme.font.size.sm, fontFamily: theme.font.mono,
            padding: `${theme.spacing.xs} ${theme.spacing.sm}`, outline: 'none',
          }}
        />
      </div>

      {/* Raw view */}
      {viewMode === 'raw' && (
        <div style={{
          background: theme.colors.terminalBg, border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.radius.md, padding: theme.spacing.md,
          height: '450px', overflowY: 'auto',
          fontFamily: theme.font.mono, fontSize: theme.font.size.xs, lineHeight: 1.6,
          color: theme.colors.muted, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {filteredContent || '(No transcript)'}
        </div>
      )}

      {/* Chat view */}
      {viewMode === 'chat' && (
        <div style={{
          background: theme.colors.surface, border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.radius.md, padding: theme.spacing.md,
          height: '450px', overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: theme.spacing.sm,
        }}>
          {bubbles.length === 0 && (
            <span style={{ color: theme.colors.muted, fontSize: theme.font.size.sm }}>No transcript available.</span>
          )}
          {bubbles.map((b, i) => {
            if (b.role === 'other') {
              return (
                <div key={i} style={{ textAlign: 'center', fontSize: theme.font.size.xs, color: theme.colors.muted, padding: `${theme.spacing.xs} 0` }}>
                  {b.text}
                </div>
              );
            }
            const isHuman = b.role === 'human';
            return (
              <div key={i} style={{ display: 'flex', justifyContent: isHuman ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '75%',
                  padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                  borderRadius: theme.radius.lg,
                  background: isHuman ? `${theme.colors.primary}22` : theme.colors.surfaceElevated,
                  border: `1px solid ${isHuman ? theme.colors.primary + '44' : theme.colors.border}`,
                  fontSize: theme.font.size.sm,
                  color: theme.colors.text,
                  lineHeight: 1.5,
                }}>
                  {b.text}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
