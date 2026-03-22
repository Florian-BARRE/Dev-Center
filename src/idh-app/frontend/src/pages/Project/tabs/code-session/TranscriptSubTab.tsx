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
    padding: '5px 14px',
    background: active ? theme.colors.accentDim : 'none',
    border: active ? `1px solid ${theme.colors.accent}33` : `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    color: active ? theme.colors.accent : theme.colors.muted,
    fontSize: theme.font.size.sm,
    fontFamily: theme.font.sans,
    fontWeight: active ? theme.font.weight.semibold : theme.font.weight.normal,
    cursor: 'pointer' as const,
    transition: theme.transition.fast,
  });

  const filteredContent = search
    ? content.split('\n').filter((l) => l.toLowerCase().includes(search.toLowerCase())).join('\n')
    : content;

  const bubbles = parseTranscript(viewMode === 'chat' ? filteredContent : '');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button onClick={() => setViewMode('raw')} style={toggleStyle(viewMode === 'raw')}>Raw</button>
        <button onClick={() => setViewMode('chat')} style={toggleStyle(viewMode === 'chat')}>Chat</button>
        <input
          placeholder="Search transcript…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            marginLeft: 'auto',
            width: '200px',
            background: theme.colors.surfaceElevated,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.md,
            color: theme.colors.text,
            fontSize: theme.font.size.sm,
            fontFamily: theme.font.mono,
            padding: '5px 10px',
            outline: 'none',
          }}
        />
      </div>

      {/* Raw view */}
      {viewMode === 'raw' && (
        <div style={{
          background: theme.colors.terminalBg,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.radius.lg,
          padding: '14px',
          height: '450px',
          overflowY: 'auto',
          fontFamily: theme.font.mono,
          fontSize: theme.font.size.xs,
          lineHeight: 1.7,
          color: theme.colors.muted,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          boxShadow: theme.shadow.card,
        }}>
          {filteredContent || '(No transcript)'}
        </div>
      )}

      {/* Chat view */}
      {viewMode === 'chat' && (
        <div style={{
          background: theme.colors.surface,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.radius.lg,
          padding: '14px',
          height: '450px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          boxShadow: theme.shadow.card,
        }}>
          {bubbles.length === 0 && (
            <span style={{ color: theme.colors.muted, fontSize: theme.font.size.sm }}>No transcript available.</span>
          )}
          {bubbles.map((b, i) => {
            if (b.role === 'other') {
              return (
                <div key={i} style={{
                  textAlign: 'center',
                  fontSize: theme.font.size.xs,
                  color: theme.colors.muted,
                  padding: '4px 0',
                }}>
                  {b.text}
                </div>
              );
            }
            const isHuman = b.role === 'human';
            return (
              <div key={i} style={{ display: 'flex', justifyContent: isHuman ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '75%',
                  padding: '8px 14px',
                  borderRadius: theme.radius.lg,
                  background: isHuman ? theme.colors.accentDim : theme.colors.surfaceElevated,
                  border: `1px solid ${isHuman ? theme.colors.accent + '33' : theme.colors.border}`,
                  fontSize: theme.font.size.sm,
                  fontFamily: theme.font.sans,
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
