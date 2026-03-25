// ====== Code Summary ======
// Rules tab — global rules block (read-only + sync button) + per-project CLAUDE.md editor.

import React, { useEffect, useState } from 'react';
import theme from '../../../theme';
import { getRules, putRules, syncRules } from '../../../api/rules';
import type { RulesResponse } from '../../../api/types';

interface RulesTabProps {
  projectId: string;
}

// Delimiter markers used to split global block from project-specific content
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

const cardStyle: React.CSSProperties = {
  background: theme.colors.surface,
  border: `1px solid ${theme.colors.border}`,
  borderRadius: theme.radius.md,
  padding: theme.spacing.lg,
  marginBottom: theme.spacing.md,
};

const sectionLabel: React.CSSProperties = {
  fontFamily: theme.font.sans,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.medium,
  color: theme.colors.muted,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: theme.spacing.sm,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing.sm,
};

export default function RulesTab({ projectId }: RulesTabProps) {
  const [data, setData] = useState<RulesResponse | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getRules(projectId).then((r) => {
      setData(r);
      setDraft(extractProjectRules(r.content));
    }).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to load rules.');
    });
  }, [projectId]);

  const save = async () => {
    if (!data || saving) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      // Reconstruct full content: global block + project-specific rules
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
      {error !== null ? (
        <span style={{ color: theme.colors.danger }}>{error}</span>
      ) : (
        <span style={{ color: theme.colors.muted }}>Loading…</span>
      )}
    </div>
  );

  const globalBlock = extractGlobalBlock(data.content);

  return (
    <div>
      {/* Global rules block */}
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

      {/* Project-specific rules */}
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
              color: theme.colors.bg,
              border: 'none',
              borderRadius: theme.radius.sm,
              padding: '6px 16px',
              fontSize: theme.fontSize.sm,
              fontFamily: theme.font.sans,
              fontWeight: theme.fontWeight.medium,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          {saved && (
            <span style={{ color: theme.colors.active, fontSize: theme.fontSize.sm, fontFamily: theme.font.sans }}>
              Saved ✓
            </span>
          )}
          {error && (
            <span style={{ color: theme.colors.danger, fontSize: theme.fontSize.sm, fontFamily: theme.font.sans }}>
              {error}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
