import { useEffect, useState } from 'react';
import { theme } from '../../../theme';
import ModelSelector from '../../../components/ModelSelector';
import MarkdownEditor from '../../../components/MarkdownEditor';
import { getClaudeMd, putClaudeMd, getTelegramPrompt, putTelegramPrompt, getModel, putModel } from '../../../api/settings';
import { MODEL_OPTIONS } from '../../../api/types';
import type { Project } from '../../../api/types';

interface SettingsTabProps {
  project: Project;
}

export default function SettingsTab({ project }: SettingsTabProps) {
  const [provider, setProvider] = useState(project.modelOverride?.provider ?? MODEL_OPTIONS[0].provider);
  const [model, setModel] = useState(project.modelOverride?.model ?? MODEL_OPTIONS[0].model);
  const [telegramPrompt, setTelegramPrompt] = useState('');
  const [claudeMd, setClaudeMd] = useState('');
  const [agentId, setAgentId] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      getModel(project.groupId),
      getTelegramPrompt(project.groupId),
      getClaudeMd(project.groupId),
    ]).then(([m, t, c]) => {
      if (m.provider) { setProvider(m.provider); setModel(m.model); }
      setTelegramPrompt(t.systemPrompt);
      setAgentId(t.agentId);
      setClaudeMd(c.content);
    }).catch((e: Error) => setError(e.message));
  }, [project.groupId]);

  const save = async (what: string, fn: () => Promise<unknown>) => {
    setSaving(what);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(null);
    }
  };

  const saveButton = (label: string, onClick: () => void) => (
    <button
      onClick={onClick}
      disabled={saving !== null}
      style={{ padding: `${theme.spacing.xs} ${theme.spacing.md}`, background: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, color: theme.colors.text, cursor: 'pointer', fontSize: theme.font.size.sm }}
    >
      {saving === label ? 'Saving...' : 'Save'}
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xl }}>
      {error && <div style={{ color: theme.colors.danger, fontSize: theme.font.size.sm }}>{error}</div>}

      {/* Model */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.sm }}>
          <h3 style={{ margin: 0, fontFamily: theme.font.mono, fontSize: theme.font.size.md }}>Model</h3>
          {saveButton('model', () => save('model', () => putModel(project.groupId, provider, model)))}
        </div>
        <ModelSelector provider={provider} model={model} onChange={(p, m) => { setProvider(p); setModel(m); }} />
      </section>

      {/* Telegram prompt */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.sm }}>
          <h3 style={{ margin: 0, fontFamily: theme.font.mono, fontSize: theme.font.size.md }}>Telegram Agent Prompt</h3>
          {saveButton('prompt', () => save('prompt', () => putTelegramPrompt(project.groupId, agentId, telegramPrompt)))}
        </div>
        <textarea
          value={telegramPrompt}
          onChange={(e) => setTelegramPrompt(e.target.value)}
          rows={6}
          style={{ width: '100%', background: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, color: theme.colors.text, fontFamily: theme.font.mono, fontSize: theme.font.size.sm, padding: theme.spacing.md, resize: 'vertical', boxSizing: 'border-box' }}
        />
      </section>

      {/* CLAUDE.md */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.sm }}>
          <h3 style={{ margin: 0, fontFamily: theme.font.mono, fontSize: theme.font.size.md }}>CLAUDE.md</h3>
          {saveButton('claude-md', () => save('claude-md', () => putClaudeMd(project.groupId, claudeMd)))}
        </div>
        <MarkdownEditor value={claudeMd} onChange={setClaudeMd} minHeight="350px" />
      </section>
    </div>
  );
}
