// ====== Code Summary ======
// Memory tab — auto-refreshing list of Claude memory files with content viewer.

import { useEffect, useRef, useState } from 'react';
import theme from '../../../theme';
import { getMemory } from '../../../api/memory';
import type { MemoryFile } from '../../../api/types';

interface MemoryTabProps {
  projectId: string;
}

const REFRESH_INTERVAL = 30_000;

export default function MemoryTab({ projectId }: MemoryTabProps) {
  const [files, setFiles] = useState<MemoryFile[]>([]);
  const [selected, setSelected] = useState<MemoryFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [hashDiscovered, setHashDiscovered] = useState(false);
  // Ref tracks the selected file's name so the polling interval can read
  // the current value without capturing a stale closure.
  const selectedNameRef = useRef<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getMemory(projectId);
        setFiles(res.files);
        setHashDiscovered(res.hashDiscovered);
        // Keep selection in sync using the ref (avoids stale closure)
        if (selectedNameRef.current) {
          const updated = res.files.find((f) => f.name === selectedNameRef.current);
          if (updated) setSelected(updated);
        }
      } catch { /* retain previous */ }
      finally { setLoading(false); }
    };
    load();
    const id = setInterval(load, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [projectId]);

  if (loading) return (
    <div style={{ color: theme.colors.muted, fontFamily: theme.font.sans, fontSize: theme.fontSize.sm }}>
      Loading…
    </div>
  );

  if (!hashDiscovered) return (
    <div style={{
      background: theme.colors.surface,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.radius.md,
      padding: theme.spacing.xl,
      color: theme.colors.muted,
      fontFamily: theme.font.sans,
      fontSize: theme.fontSize.sm,
    }}>
      Memory hash not yet discovered. Start a session and wait a few seconds.
    </div>
  );

  if (files.length === 0) return (
    <div style={{
      background: theme.colors.surface,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.radius.md,
      padding: theme.spacing.xl,
      color: theme.colors.muted,
      fontFamily: theme.font.sans,
      fontSize: theme.fontSize.sm,
    }}>
      No memory files yet. Claude will create them after the first session.
    </div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: theme.spacing.md, alignItems: 'start' }}>
      {/* File list */}
      <div style={{
        background: theme.colors.surface,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.radius.md,
        overflow: 'hidden',
      }}>
        {files.map((f, i) => (
          <button
            key={f.name}
            onClick={() => { setSelected(f); selectedNameRef.current = f.name; }}
            style={{
              width: '100%',
              display: 'block',
              padding: '10px 14px',
              background: selected?.name === f.name ? theme.colors.surfaceHover : 'none',
              border: 'none',
              // Omit bottom border on the last item to avoid a double-border artifact
              // against the container's rounded bottom edge.
              borderBottom: i < files.length - 1 ? `1px solid ${theme.colors.border}` : 'none',
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <div style={{ fontFamily: theme.font.mono, fontSize: theme.fontSize.xs, color: theme.colors.text, marginBottom: '2px' }}>
              {f.name}
            </div>
            <div style={{ fontFamily: theme.font.sans, fontSize: theme.fontSize.xs, color: theme.colors.muted }}>
              {new Date(f.updatedAt).toLocaleString()}
            </div>
          </button>
        ))}
      </div>

      {/* Content viewer */}
      <div style={{
        background: theme.colors.surface,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.radius.md,
        padding: theme.spacing.lg,
        minHeight: '200px',
      }}>
        {selected ? (
          <pre style={{
            fontFamily: theme.font.mono,
            fontSize: theme.fontSize.xs,
            color: theme.colors.text,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            margin: 0,
          }}>
            {selected.content}
          </pre>
        ) : (
          <div style={{ color: theme.colors.muted, fontFamily: theme.font.sans, fontSize: theme.fontSize.sm }}>
            Select a file to view its content.
          </div>
        )}
      </div>
    </div>
  );
}
