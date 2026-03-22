import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { theme } from '../../../theme';
import ModelSelector from '../../../components/ModelSelector';
import MarkdownEditor from '../../../components/MarkdownEditor';
import { getModel, putModel, getTelegramPrompt, putTelegramPrompt } from '../../../api/settings';
import { getSessionMemory, putSessionMemory } from '../../../api/memory';
import { MODEL_OPTIONS } from '../../../api/types';
import type { Project } from '../../../api/types';

interface TelegramTabProps {
  project: Project;
}

const QUICK_COMMANDS = [
  'Show progress summary',
  'Commit and push current changes',
  'Run tests and report',
];

const STORAGE_KEY = (groupId: string) => `idh-quick-commands-${groupId}`;

function SectionCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div style={{
      background: theme.colors.surface,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.radius.lg,
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
        borderBottom: `1px solid ${theme.colors.border}`,
        background: theme.colors.surfaceElevated,
      }}>
        <span style={{ fontSize: theme.font.size.sm, fontWeight: theme.font.weight.semibold, color: theme.colors.text }}>{title}</span>
        {action}
      </div>
      <div style={{ padding: theme.spacing.lg }}>{children}</div>
    </div>
  );
}

export default function TelegramTab({ project }: TelegramTabProps) {
  const [provider, setProvider] = useState(project.modelOverride?.provider ?? MODEL_OPTIONS[0].provider);
  const [model, setModel] = useState(project.modelOverride?.model ?? MODEL_OPTIONS[0].model);
  const [telegramPrompt, setTelegramPrompt] = useState('');
  const [sessionMemory, setSessionMemory] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [customCommands, setCustomCommands] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY(project.groupId)) ?? '[]') as string[]; }
    catch { return []; }
  });
  const [newCommandInput, setNewCommandInput] = useState('');
  const [showAddCommand, setShowAddCommand] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getModel(project.groupId),
      getTelegramPrompt(project.groupId),
      getSessionMemory(project.projectId),
    ]).then(([m, t, s]) => {
      if (cancelled) return;
      setProvider(m.provider); setModel(m.model);
      setTelegramPrompt(t.systemPrompt);
      setSessionMemory(s.content);
    }).catch((e: Error) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [project.groupId, project.projectId]);

  const save = async (id: string, fn: () => Promise<unknown>) => {
    setSaving(id); setError(null);
    try { await fn(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Save failed'); }
    finally { setSaving(null); }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2500);
  };

  const copyCommand = (cmd: string) => {
    navigator.clipboard?.writeText(cmd).catch(() => {});
    showToast(`Copied: "${cmd}"`);
  };

  const addCustomCommand = () => {
    if (!newCommandInput.trim()) return;
    const updated = [...customCommands, newCommandInput.trim()];
    setCustomCommands(updated);
    localStorage.setItem(STORAGE_KEY(project.groupId), JSON.stringify(updated));
    setNewCommandInput('');
    setShowAddCommand(false);
  };

  const SaveButton = ({ id, onClick }: { id: string; onClick: () => void }) => (
    <button onClick={onClick} disabled={saving !== null} style={{
      padding: `${theme.spacing.xs} ${theme.spacing.md}`,
      background: theme.colors.surfaceElevated,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.radius.md,
      color: theme.colors.text,
      cursor: saving !== null ? 'not-allowed' : 'pointer',
      fontSize: theme.font.size.sm,
      fontWeight: theme.font.weight.medium,
      opacity: saving !== null && saving !== id ? 0.5 : 1,
      transition: theme.transition.fast,
    }}>
      {saving === id ? 'Saving…' : 'Save'}
    </button>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: theme.spacing.lg, alignItems: 'start' }}>
      {/* Left panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.lg }}>
        {error && (
          <div style={{ padding: `${theme.spacing.sm} ${theme.spacing.md}`, background: theme.colors.dangerBg, border: `1px solid ${theme.colors.danger}44`, borderRadius: theme.radius.sm, color: theme.colors.danger, fontSize: theme.font.size.sm }}>
            {error}
          </div>
        )}

        <SectionCard title="AI Model" action={<SaveButton id="model" onClick={() => save('model', () => putModel(project.groupId, provider, model))} />}>
          <ModelSelector provider={provider} model={model} onChange={(p, m) => { setProvider(p); setModel(m); }} />
        </SectionCard>

        <SectionCard title="System Prompt" action={<SaveButton id="prompt" onClick={() => save('prompt', () => putTelegramPrompt(project.groupId, project.projectId, telegramPrompt))} />}>
          <textarea
            value={telegramPrompt}
            onChange={(e) => setTelegramPrompt(e.target.value)}
            rows={8}
            style={{
              width: '100%',
              background: theme.colors.bg,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radius.md,
              color: theme.colors.text,
              fontFamily: theme.font.mono,
              fontSize: theme.font.size.sm,
              padding: theme.spacing.md,
              resize: 'vertical',
              boxSizing: 'border-box',
              outline: 'none',
              lineHeight: 1.6,
            }}
          />
          <div style={{ marginTop: theme.spacing.xs, fontSize: theme.font.size.xs, color: theme.colors.muted, textAlign: 'right' }}>
            {telegramPrompt.length} chars · ~{Math.round(telegramPrompt.length / 4)} tokens
          </div>
        </SectionCard>

        <SectionCard title="SESSION_MEMORY.md" action={<SaveButton id="memory" onClick={() => save('memory', () => putSessionMemory(project.projectId, sessionMemory))} />}>
          <MarkdownEditor value={sessionMemory} onChange={setSessionMemory} minHeight="300px" />
        </SectionCard>
      </div>

      {/* Right panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.lg }}>
        <SectionCard title="Quick Commands">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.xs, marginBottom: theme.spacing.md }}>
            {[...QUICK_COMMANDS, ...customCommands].map((cmd, i) => (
              <button key={i} onClick={() => copyCommand(cmd)} style={{
                padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                background: theme.colors.surfaceElevated,
                border: `1px solid ${theme.colors.borderAccent}`,
                borderRadius: theme.radius.full,
                color: theme.colors.textSecondary,
                fontSize: theme.font.size.xs,
                cursor: 'pointer',
                transition: theme.transition.fast,
              }}>
                {cmd}
              </button>
            ))}
            <button onClick={() => setShowAddCommand(!showAddCommand)} style={{
              padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
              background: 'none',
              border: `1px dashed ${theme.colors.border}`,
              borderRadius: theme.radius.full,
              color: theme.colors.muted,
              fontSize: theme.font.size.xs,
              cursor: 'pointer',
            }}>
              + Add custom
            </button>
          </div>
          {showAddCommand && (
            <div style={{ display: 'flex', gap: theme.spacing.xs }}>
              <input
                value={newCommandInput}
                onChange={(e) => setNewCommandInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addCustomCommand(); }}
                placeholder="Type a command…"
                style={{
                  flex: 1,
                  background: theme.colors.bg,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.radius.md,
                  color: theme.colors.text,
                  fontSize: theme.font.size.sm,
                  padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                  outline: 'none',
                }}
              />
              <button onClick={addCustomCommand} style={{
                padding: `${theme.spacing.xs} ${theme.spacing.md}`,
                background: theme.colors.primary,
                border: 'none',
                borderRadius: theme.radius.md,
                color: theme.colors.onPrimary,
                fontSize: theme.font.size.sm,
                cursor: 'pointer',
              }}>
                Add
              </button>
            </div>
          )}
          {toast && (
            <div style={{ marginTop: theme.spacing.sm, fontSize: theme.font.size.xs, color: theme.colors.success }}>
              {toast}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
