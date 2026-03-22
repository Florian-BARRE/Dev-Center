import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { theme } from '../../../theme';
import ModelSelector from '../../../components/ModelSelector';
import ScheduleEditor from '../../../components/ScheduleEditor';
import CountdownTimer from '../../../components/CountdownTimer';
import CodingRulesEditor from '../../../components/CodingRulesEditor';
import { getModel, putModel, getClaudeMd, putClaudeMd, getProjectSchedule, putProjectSchedule } from '../../../api/settings';
import { getSessionMemory } from '../../../api/memory';
import type { ScheduleConfig } from '../../../api/types';
import { startBridge, stopBridge } from '../../../api/bridge';
import { ApiError } from '../../../api/client';
import { MODEL_OPTIONS } from '../../../api/types';
import type { Project } from '../../../api/types';

interface CodeSessionTabProps {
  project: Project;
  onProjectChange: (updated: Project) => void;
}

// ── Section card ──────────────────────────────────────────────────────────────

function SectionCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div style={{
      background: theme.colors.surface,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.radius.lg,
      overflow: 'hidden',
      boxShadow: theme.shadow.card,
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 16px',
        borderBottom: `1px solid ${theme.colors.border}`,
        background: theme.colors.surfaceElevated,
      }}>
        <span style={{
          fontSize: theme.font.size.sm,
          fontFamily: theme.font.sans,
          fontWeight: theme.font.weight.semibold,
          color: theme.colors.text,
        }}>
          {title}
        </span>
        {action}
      </div>
      <div style={{ padding: '16px' }}>{children}</div>
    </div>
  );
}

function SaveButton({ id, saving, onClick }: { id: string; saving: string | null; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={saving !== null}
      style={{
        padding: '4px 12px',
        background: theme.colors.accent,
        border: 'none',
        borderRadius: theme.radius.md,
        color: theme.colors.onPrimary,
        cursor: saving !== null ? 'not-allowed' : 'pointer',
        fontSize: theme.font.size.sm,
        fontFamily: theme.font.sans,
        fontWeight: theme.font.weight.medium,
        opacity: saving !== null && saving !== id ? 0.5 : 1,
        transition: theme.transition.fast,
      }}
    >
      {saving === id ? 'Saving…' : 'Save'}
    </button>
  );
}

// ── CodeSessionTab ────────────────────────────────────────────────────────────

export default function CodeSessionTab({ project, onProjectChange }: CodeSessionTabProps) {
  const [provider, setProvider] = useState(project.modelOverride?.provider ?? MODEL_OPTIONS[0].provider);
  const [model, setModel] = useState(project.modelOverride?.model ?? MODEL_OPTIONS[0].model);
  const [claudeMd, setClaudeMd] = useState('');
  const [schedule, setSchedule] = useState<ScheduleConfig | null>(null);
  const [sessionMemory, setSessionMemory] = useState('');
  const [memoryUpdatedAt, setMemoryUpdatedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Load model, CLAUDE.md, and schedule on mount
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getModel(project.groupId),
      getClaudeMd(project.groupId).catch(() => ({ content: '' })),
      getProjectSchedule(project.groupId).catch(() => null),
    ]).then(([m, c, s]) => {
      if (cancelled) return;
      if (m.provider) { setProvider(m.provider); setModel(m.model); }
      setClaudeMd(c.content);
      setSchedule(s);
    }).catch((e: Error) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [project.groupId]);

  // 2. Poll SESSION_MEMORY.md every 10 s (read-only viewer)
  useEffect(() => {
    let cancelled = false;
    const fetch = () => {
      getSessionMemory(project.projectId)
        .then((r) => { if (!cancelled) { setSessionMemory(r.content); setMemoryUpdatedAt(new Date()); } })
        .catch((e) => { if (!cancelled && e instanceof ApiError && e.status === 404) setSessionMemory(''); });
    };
    fetch();
    const id = setInterval(fetch, 10_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [project.projectId]);

  const save = async (id: string, fn: () => Promise<unknown>) => {
    setSaving(id); setError(null);
    try { await fn(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Save failed'); }
    finally { setSaving(null); }
  };

  // 3. Bridge start / stop
  const handleStart = async () => {
    setActionBusy(true); setError(null);
    try {
      await startBridge(project.groupId);
      // Reload project so bridge state is fresh
      const { getProject } = await import('../../../api/projects');
      const updated = await getProject(project.groupId);
      onProjectChange(updated);
    } catch (e) { setError(e instanceof Error ? e.message : 'Start failed'); }
    finally { setActionBusy(false); }
  };

  const handleStop = async () => {
    setActionBusy(true); setError(null);
    try {
      await stopBridge(project.groupId);
      const { getProject } = await import('../../../api/projects');
      const updated = await getProject(project.groupId);
      onProjectChange(updated);
    } catch (e) { setError(e instanceof Error ? e.message : 'Stop failed'); }
    finally { setActionBusy(false); }
  };

  const isRunning = project.bridge !== null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '16px', alignItems: 'start' }}>
      {/* Left panel */}
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

        {/* Model selector */}
        <SectionCard
          title="Session Model"
          action={
            <SaveButton
              id="model"
              saving={saving}
              onClick={() => save('model', () => putModel(project.groupId, provider, model))}
            />
          }
        >
          <ModelSelector provider={provider} model={model} onChange={(p, m) => { setProvider(p); setModel(m); }} />
        </SectionCard>

        {/* CLAUDE.md editor with multi-file upload */}
        <SectionCard
          title="Coding Rules (CLAUDE.md)"
          action={
            <SaveButton
              id="claude-md"
              saving={saving}
              onClick={() => save('claude-md', () => putClaudeMd(project.groupId, claudeMd))}
            />
          }
        >
          <CodingRulesEditor value={claudeMd} onChange={setClaudeMd} />
        </SectionCard>

        {/* SESSION_MEMORY.md read-only viewer */}
        <SectionCard title="Session Memory (read-only)">
          {sessionMemory ? (
            <pre style={{
              margin: 0,
              padding: '10px 12px',
              background: theme.colors.bg,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radius.md,
              color: theme.colors.text,
              fontFamily: theme.font.mono,
              fontSize: theme.font.size.xs,
              lineHeight: 1.6,
              overflowY: 'auto',
              maxHeight: '300px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {sessionMemory}
            </pre>
          ) : (
            <div style={{ color: theme.colors.muted, fontSize: theme.font.size.sm, fontFamily: theme.font.sans, fontStyle: 'italic' }}>
              No session memory yet — updated after each session ends.
            </div>
          )}
          {memoryUpdatedAt && (
            <div style={{ marginTop: '6px', fontSize: theme.font.size.xs, color: theme.colors.muted, fontFamily: theme.font.mono }}>
              Last checked: {memoryUpdatedAt.toLocaleTimeString()}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Right panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Session status */}
        <SectionCard title="Code Session">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Status row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: theme.font.size.sm, fontFamily: theme.font.sans, color: theme.colors.muted }}>Status</span>
              <span style={{
                padding: '2px 8px',
                borderRadius: theme.radius.full,
                fontSize: theme.font.size.xs,
                fontFamily: theme.font.sans,
                fontWeight: theme.font.weight.semibold,
                background: isRunning ? `${theme.colors.success}22` : `${theme.colors.muted}22`,
                color: isRunning ? theme.colors.success : theme.colors.muted,
              }}>
                {isRunning ? 'Running' : 'Stopped'}
              </span>
            </div>

            {/* PID row */}
            {project.bridge && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: theme.font.size.sm, fontFamily: theme.font.sans, color: theme.colors.muted }}>PID</span>
                <span style={{ fontSize: theme.font.size.sm, fontFamily: theme.font.mono, color: theme.colors.text }}>
                  {project.bridge.pid}
                </span>
              </div>
            )}

            {/* Expiry countdown */}
            {project.bridge && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: theme.font.size.sm, fontFamily: theme.font.sans, color: theme.colors.muted }}>Expires</span>
                <CountdownTimer expiresAt={project.bridge.expiresAt} />
              </div>
            )}

            {/* Start / Stop button */}
            <button
              onClick={isRunning ? handleStop : handleStart}
              disabled={actionBusy}
              style={{
                marginTop: '4px',
                padding: '8px 16px',
                background: isRunning ? theme.colors.dangerBg : theme.colors.accentDim,
                border: `1px solid ${isRunning ? theme.colors.danger : theme.colors.accent}44`,
                borderRadius: theme.radius.md,
                color: isRunning ? theme.colors.danger : theme.colors.accent,
                cursor: actionBusy ? 'not-allowed' : 'pointer',
                fontSize: theme.font.size.sm,
                fontFamily: theme.font.sans,
                fontWeight: theme.font.weight.semibold,
                transition: theme.transition.fast,
                opacity: actionBusy ? 0.6 : 1,
              }}
            >
              {actionBusy ? '…' : isRunning ? 'Stop Session' : 'Start Session'}
            </button>
          </div>
        </SectionCard>

        {/* Schedule editor */}
        {schedule !== null && (
          <ScheduleEditor
            value={schedule}
            onChange={(updated) => {
              setSchedule(updated);
              putProjectSchedule(project.groupId, updated).catch((e: Error) => setError(e.message));
            }}
          />
        )}
      </div>
    </div>
  );
}
