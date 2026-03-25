// ====== Code Summary ======
// Rules tab — upload .md rule files (auto-applied to CLAUDE.md alphabetically),
// global rules block (read-only + sync), and per-project CLAUDE.md editor.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import theme from '../../../theme';
import { getRules, putRules, syncRules, listRuleFiles, uploadRuleFiles, deleteRuleFile } from '../../../api/rules';
import type { RulesResponse, RulesFile } from '../../../api/types';

interface RulesTabProps {
  projectId: string;
}

const GLOBAL_START = '<!-- dev-center: global-rules-start -->';
const GLOBAL_END   = '<!-- dev-center: global-rules-end -->';

function extractGlobalBlock(content: string): string {
  const si = content.indexOf(GLOBAL_START);
  const ei = content.indexOf(GLOBAL_END);
  if (si < 0 || ei < 0) return '';
  return content.slice(si + GLOBAL_START.length, ei).trim();
}

function extractProjectRules(content: string): string {
  const ei = content.indexOf(GLOBAL_END);
  if (ei < 0) return content;
  return content.slice(ei + GLOBAL_END.length).trim();
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

const cardStyle: React.CSSProperties = {
  background: theme.colors.surface,
  border: `1px solid ${theme.colors.border}`,
  borderRadius: theme.radius.lg,
  padding: theme.spacing.lg,
  marginBottom: theme.spacing.md,
};

const sectionLabel: React.CSSProperties = {
  fontFamily: theme.font.display,
  fontSize: theme.fontSize.xs,
  fontWeight: 700,
  color: theme.colors.muted,
  textTransform: 'uppercase',
  letterSpacing: '0.10em',
  marginBottom: theme.spacing.sm,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing.sm,
};

export default function RulesTab({ projectId }: RulesTabProps) {
  const [data, setData]       = useState<RulesResponse | null>(null);
  const [draft, setDraft]     = useState('');
  const [files, setFiles]     = useState<RulesFile[]>([]);
  const [saving, setSaving]   = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load CLAUDE.md content and rule files list in parallel.
  useEffect(() => {
    Promise.all([
      getRules(projectId),
      listRuleFiles(projectId),
    ]).then(([rules, rf]) => {
      setData(rules);
      setDraft(extractProjectRules(rules.content));
      setFiles(rf.files);
    }).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to load rules.');
    });
  }, [projectId]);

  // ── Upload ────────────────────────────────────────────────────────────────

  const handleUpload = useCallback(async (picked: FileList | File[]) => {
    const mdFiles = Array.from(picked).filter(f => f.name.toLowerCase().endsWith('.md'));
    if (mdFiles.length === 0) {
      setError('Only .md files are accepted.');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const updated = await uploadRuleFiles(projectId, mdFiles);
      const rf = await listRuleFiles(projectId);
      setData(updated);
      setDraft(extractProjectRules(updated.content));
      setFiles(rf.files);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }, [projectId]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) handleUpload(e.dataTransfer.files);
  }, [handleUpload]);

  const handleDelete = async (filename: string) => {
    setError(null);
    try {
      const updated = await deleteRuleFile(projectId, filename);
      const rf = await listRuleFiles(projectId);
      setData(updated);
      setDraft(extractProjectRules(updated.content));
      setFiles(rf.files);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
    }
  };

  // ── Save CLAUDE.md manually ───────────────────────────────────────────────

  const save = async () => {
    if (!data || saving) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const globalBlock = data.content.slice(
        0,
        data.content.indexOf(GLOBAL_END) + GLOBAL_END.length
      );
      const newContent = globalBlock ? `${globalBlock}\n\n${draft}` : draft;
      const updated = await putRules(projectId, newContent);
      setData(updated);
      setDraft(extractProjectRules(updated.content));
      setSaved(true);
      setTimeout(() => setSaved(false), 2_000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save rules.');
    } finally {
      setSaving(false);
    }
  };

  const sync = async () => {
    if (syncing) return;
    setSyncing(true);
    setError(null);
    try {
      const updated = await syncRules(projectId);
      setData(updated);
      setDraft(extractProjectRules(updated.content));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to sync global rules.');
    } finally {
      setSyncing(false);
    }
  };

  if (!data) return (
    <div style={{ fontFamily: theme.font.sans, fontSize: theme.fontSize.sm }}>
      {error !== null
        ? <span style={{ color: theme.colors.danger }}>{error}</span>
        : <span style={{ color: theme.colors.muted }}>Loading…</span>
      }
    </div>
  );

  const globalBlock = extractGlobalBlock(data.content);

  return (
    <div>
      {/* ── Rule files upload ─────────────────────────────────────────────── */}
      <div style={cardStyle}>
        <div style={sectionLabel}>
          Rule Files
          <span style={{ color: theme.colors.muted, fontWeight: theme.fontWeight.normal, textTransform: 'none', letterSpacing: 0 }}>
            — uploaded .md files are concatenated alphabetically into CLAUDE.md
          </span>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `1px dashed ${dragOver ? theme.colors.accent : theme.colors.borderStrong}`,
            borderRadius: theme.radius.md,
            padding: '20px',
            textAlign: 'center',
            cursor: uploading ? 'not-allowed' : 'pointer',
            background: dragOver ? theme.colors.surfaceHover : 'transparent',
            transition: 'border-color 0.15s, background 0.15s',
            marginBottom: files.length > 0 ? theme.spacing.md : 0,
            opacity: uploading ? 0.6 : 1,
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".md"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => e.target.files && handleUpload(e.target.files)}
          />
          <span style={{
            fontFamily: theme.font.sans,
            fontSize: theme.fontSize.sm,
            color: theme.colors.textSecondary,
          }}>
            {uploading ? 'Uploading…' : 'Drop .md files here or click to browse'}
          </span>
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {files.map((f, i) => (
              <div key={f.filename} style={{
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 10px',
                background: theme.colors.bg,
                borderRadius: theme.radius.sm,
                border: `1px solid ${theme.colors.border}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {/* Alphabetical order badge */}
                  <span style={{
                    fontFamily: theme.font.mono,
                    fontSize: '10px',
                    color: theme.colors.muted,
                    minWidth: '16px',
                    textAlign: 'right',
                  }}>
                    {i + 1}.
                  </span>
                  <span style={{
                    fontFamily: theme.font.mono,
                    fontSize: theme.fontSize.sm,
                    color: theme.colors.text,
                  }}>
                    {f.filename}
                  </span>
                  <span style={{
                    fontFamily: theme.font.sans,
                    fontSize: theme.fontSize.xs,
                    color: theme.colors.muted,
                  }}>
                    {formatSize(f.size)}
                  </span>
                </div>
                <button
                  onClick={() => handleDelete(f.filename)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: theme.colors.muted,
                    fontSize: theme.fontSize.xs,
                    fontFamily: theme.font.sans,
                    padding: '2px 6px',
                    borderRadius: theme.radius.sm,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = theme.colors.danger)}
                  onMouseLeave={e => (e.currentTarget.style.color = theme.colors.muted)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div style={{ marginTop: theme.spacing.sm, color: theme.colors.danger, fontFamily: theme.font.sans, fontSize: theme.fontSize.sm }}>
            {error}
          </div>
        )}
      </div>

      {/* ── Global rules block ────────────────────────────────────────────── */}
      <div style={cardStyle}>
        <div style={sectionLabel}>
          Global Rules
          {data.globalRulesOutOfSync && (
            <>
              <span style={{
                background: theme.colors.warning + '22',
                border: `1px solid ${theme.colors.warning}44`,
                borderRadius: theme.radius.full,
                color: theme.colors.warning,
                fontSize: theme.fontSize.xs,
                fontFamily: theme.font.sans,
                padding: '1px 8px',
              }}>
                Out of sync
              </span>
              <button
                onClick={sync}
                disabled={syncing}
                style={{
                  background: 'none',
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.radius.sm,
                  color: theme.colors.textSecondary,
                  cursor: syncing ? 'not-allowed' : 'pointer',
                  fontSize: theme.fontSize.xs,
                  fontFamily: theme.font.sans,
                  padding: '2px 10px',
                  opacity: syncing ? 0.6 : 1,
                }}
              >
                {syncing ? 'Syncing…' : 'Sync'}
              </button>
            </>
          )}
        </div>
        {globalBlock ? (
          <pre style={{
            background: theme.colors.bg,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.sm,
            padding: theme.spacing.md,
            fontFamily: theme.font.mono,
            fontSize: theme.fontSize.xs,
            color: theme.colors.textSecondary,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            margin: 0,
            maxHeight: '200px',
            overflowY: 'auto',
          }}>
            {globalBlock}
          </pre>
        ) : (
          <div style={{ color: theme.colors.muted, fontFamily: theme.font.sans, fontSize: theme.fontSize.sm }}>
            No global rules configured.
          </div>
        )}
      </div>

      {/* ── CLAUDE.md editor ─────────────────────────────────────────────── */}
      <div style={cardStyle}>
        <div style={sectionLabel}>Project Rules (CLAUDE.md)</div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          style={{
            width: '100%',
            minHeight: '200px',
            background: theme.colors.bg,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.sm,
            color: theme.colors.text,
            fontFamily: theme.font.mono,
            fontSize: theme.fontSize.sm,
            padding: theme.spacing.md,
            resize: 'vertical',
            boxSizing: 'border-box',
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: theme.spacing.sm, marginTop: theme.spacing.sm, alignItems: 'center' }}>
          <button
            onClick={save}
            disabled={saving}
            style={{
              background: theme.colors.accent,
              color: '#050A14',
              border: 'none',
              borderRadius: theme.radius.md,
              padding: '6px 18px',
              fontSize: theme.fontSize.xs,
              fontFamily: theme.font.sans,
              fontWeight: theme.fontWeight.semibold,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
              letterSpacing: '0.04em',
              boxShadow: saving ? 'none' : '0 0 10px rgba(56,189,248,0.25)',
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          {saved && (
            <span style={{ color: theme.colors.active, fontSize: theme.fontSize.sm, fontFamily: theme.font.sans }}>
              Saved ✓
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
