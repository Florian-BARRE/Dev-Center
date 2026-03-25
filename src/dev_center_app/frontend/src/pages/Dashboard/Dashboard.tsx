// ====== Code Summary ======
// Dashboard — stats strip + project cards + Add Project modal.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import theme from '../../theme';
import { listProjects, createProject } from '../../api/projects';
import { wsUrl } from '../../api/client';
import type { Project } from '../../api/types';
import { ProjectCard } from './ProjectCard';
import ModelSelector from '../../components/ModelSelector';

const REFRESH_INTERVAL = 15_000;

// ── Add Project Modal ──────────────────────────────────────────────────────

function deriveSlug(url: string): string {
  try {
    const segment = url.replace(/\.git$/, '').split('/').filter(Boolean).pop() ?? '';
    return segment.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  } catch {
    return '';
  }
}

interface AddProjectModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function AddProjectModal({ onClose, onSuccess }: AddProjectModalProps) {
  const [repoUrl, setRepoUrl] = useState('');
  const [provider, setProvider] = useState('anthropic');
  const [model, setModel] = useState('claude-sonnet-4-6');
  const [phase, setPhase] = useState<'form' | 'cloning' | 'error'>('form');
  const [logLines, setLogLines] = useState<string[]>([]);
  const [error, setError] = useState('');
  const wsRef = useRef<WebSocket | null>(null);
  const navigate = useNavigate();

  const slug = deriveSlug(repoUrl);

  const submit = async () => {
    if (!repoUrl.trim()) return;
    try {
      const project = await createProject({ repoUrl: repoUrl.trim(), model, provider });
      // Connect to clone stream
      setPhase('cloning');
      const ws = new WebSocket(wsUrl(`/api/v1/projects/${project.id}/clone/stream`));
      wsRef.current = ws;
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data as string) as { type: string; line?: string; success?: boolean; error?: string };
          if (msg.type === 'progress' && msg.line) {
            setLogLines((prev) => [...prev, msg.line!]);
          } else if (msg.type === 'done') {
            ws.close();
            if (msg.success) {
              onSuccess();
              navigate(`/projects/${project.id}`);
            } else {
              setError(msg.error ?? 'Clone failed');
              setPhase('error');
            }
          }
        } catch { /* ignore */ }
      };
      ws.onerror = () => {
        setError('Connection to clone stream failed');
        setPhase('error');
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
      setPhase('error');
    }
  };

  useEffect(() => () => { wsRef.current?.close(); }, []);

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: theme.colors.bg,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.sm,
    color: theme.colors.text,
    fontFamily: theme.font.mono,
    fontSize: theme.fontSize.sm,
    padding: '8px 12px',
    outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: theme.colors.surface,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.radius.lg,
        width: '480px',
        maxWidth: '90vw',
        padding: theme.spacing.xl,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: theme.spacing.xl }}>
          <span style={{ fontFamily: theme.font.sans, fontWeight: theme.fontWeight.semibold, fontSize: theme.fontSize.lg, color: theme.colors.text }}>
            Add Project
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: theme.colors.muted, cursor: 'pointer', fontSize: '18px' }}>✕</button>
        </div>

        {(phase === 'form' || phase === 'error') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
            <div>
              <label style={{ display: 'block', fontFamily: theme.font.sans, fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                GitHub HTTPS URL
              </label>
              <input
                style={inputStyle}
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/user/repo"
                autoFocus
              />
              {slug && (
                <div style={{ marginTop: '4px', fontFamily: theme.font.mono, fontSize: theme.fontSize.xs, color: theme.colors.muted }}>
                  Project ID: {slug}
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontFamily: theme.font.sans, fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Model
              </label>
              <ModelSelector
                provider={provider}
                model={model}
                onChange={(p, m) => { setProvider(p); setModel(m); }}
              />
            </div>

            {phase === 'error' && (
              <div style={{ color: theme.colors.danger, fontSize: theme.fontSize.sm, fontFamily: theme.font.sans }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: theme.spacing.sm, justifyContent: 'flex-end', marginTop: theme.spacing.sm }}>
              <button onClick={onClose} style={{
                background: 'none', border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.radius.sm, padding: '7px 16px',
                color: theme.colors.textSecondary, cursor: 'pointer',
                fontSize: theme.fontSize.sm, fontFamily: theme.font.sans,
              }}>
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={!repoUrl.trim()}
                style={{
                  background: theme.colors.accent, border: 'none',
                  borderRadius: theme.radius.sm, padding: '7px 16px',
                  color: theme.colors.bg, cursor: repoUrl.trim() ? 'pointer' : 'not-allowed',
                  fontSize: theme.fontSize.sm, fontFamily: theme.font.sans, fontWeight: theme.fontWeight.semibold,
                  opacity: repoUrl.trim() ? 1 : 0.5,
                }}
              >
                {phase === 'error' ? 'Retry' : 'Add'}
              </button>
            </div>
          </div>
        )}

        {phase === 'cloning' && (
          <div>
            <div style={{ fontFamily: theme.font.sans, fontSize: theme.fontSize.sm, color: theme.colors.textSecondary, marginBottom: theme.spacing.md }}>
              Cloning repository…
            </div>
            <div style={{
              background: theme.colors.bg,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radius.sm,
              padding: theme.spacing.md,
              fontFamily: theme.font.mono,
              fontSize: theme.fontSize.xs,
              color: theme.colors.textSecondary,
              maxHeight: '200px',
              overflowY: 'auto',
            }}>
              {logLines.map((l, i) => <div key={i}>{l}</div>)}
              {logLines.length === 0 && <span style={{ color: theme.colors.muted }}>Starting…</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────────────

interface DashboardProps {
  showNewProject?: boolean;
}

export default function Dashboard({ showNewProject }: DashboardProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(showNewProject ?? false);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const projs = await listProjects();
      setProjects(projs);
    } catch {
      // retain previous data on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (showNewProject) setShowModal(true);
  }, [showNewProject]);

  const activeCount = projects.filter((p) => p.status === 'active').length;
  const idleCount = projects.filter((p) => p.status === 'ready').length;

  return (
    <div style={{ maxWidth: theme.maxWidth, margin: '0 auto', padding: `${theme.spacing['2xl']} ${theme.spacing.xl}` }}>
      {/* Stats strip */}
      <div style={{ display: 'flex', gap: theme.spacing.md, marginBottom: theme.spacing['2xl'] }}>
        <StatChip dot="active" count={activeCount} label="active" />
        <StatChip dot="idle"   count={idleCount}   label="idle" />
        <StatChip count={projects.length} label="total" />
      </div>

      {/* Section header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: theme.spacing.md,
        paddingBottom: theme.spacing.sm,
        borderBottom: `1px solid ${theme.colors.border}`,
      }}>
        <span style={{ fontFamily: theme.font.sans, fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.medium, color: theme.colors.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          PROJECTS
        </span>
        <button
          onClick={() => { setShowModal(true); navigate('/projects/new', { replace: true }); }}
          style={{
            background: 'none', border: 'none',
            color: theme.colors.textSecondary, cursor: 'pointer',
            fontSize: theme.fontSize.xs, fontFamily: theme.font.sans,
          }}
        >
          + New
        </button>
      </div>

      {loading ? (
        <div style={{ color: theme.colors.muted, fontFamily: theme.font.sans, fontSize: theme.fontSize.sm }}>Loading…</div>
      ) : projects.length === 0 ? (
        <div style={{ color: theme.colors.muted, fontFamily: theme.font.sans, fontSize: theme.fontSize.sm, padding: `${theme.spacing.xl} 0` }}>
          No projects yet — <button onClick={() => setShowModal(true)} style={{ background: 'none', border: 'none', color: theme.colors.text, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>add one →</button>
        </div>
      ) : (
        projects.map((p) => (
          <ProjectCard key={p.id} project={p} onRefresh={load} />
        ))
      )}

      {showModal && (
        <AddProjectModal
          onClose={() => { setShowModal(false); navigate('/', { replace: true }); }}
          onSuccess={load}
        />
      )}
    </div>
  );
}

// ── StatChip ──────────────────────────────────────────────────────────────

function StatChip({ dot, count, label }: { dot?: 'active' | 'idle'; count: number; label: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      background: theme.colors.surface, border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.radius.md, padding: '6px 12px',
      fontFamily: theme.font.sans, fontSize: theme.fontSize.xs, color: theme.colors.textSecondary,
    }}>
      {dot === 'active' && <span style={{ color: theme.colors.active }}>●</span>}
      {dot === 'idle'   && <span style={{ color: theme.colors.muted }}>○</span>}
      <strong style={{ color: theme.colors.text, fontWeight: theme.fontWeight.semibold }}>{count}</strong>
      {label}
    </div>
  );
}
