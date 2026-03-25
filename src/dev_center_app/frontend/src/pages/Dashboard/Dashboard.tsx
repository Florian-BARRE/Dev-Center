// ====== Code Summary ======
// Dashboard page with complete operational metrics, project actions, deploy flow, and live events.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { wsUrl } from '../../api/client';
import { createProject, listProjects } from '../../api/projects';
import type { Project } from '../../api/types';
import EventFeed from '../../components/EventFeed';
import ModelSelector from '../../components/ModelSelector';
import theme from '../../theme';
import { ProjectCard } from './ProjectCard';

const REFRESH_INTERVAL = 15_000;
const EXPIRING_SOON_MS = 45 * 60 * 1_000;

interface DashboardProps {
  showNewProject?: boolean;
}

interface ExpiringProject {
  id: string;
  name: string;
  remainingMs: number;
}

interface DeployModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function deriveSlug(url: string): string {
  return url
    .replace(/\.git$/, '')
    .split('/')
    .filter(Boolean)
    .pop()
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') ?? '';
}

function formatDuration(ms: number): string {
  if (ms <= 0) return 'expired';
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function MetricCard({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: string | number;
  hint: string;
  tone?: 'neutral' | 'good' | 'warn';
}): JSX.Element {
  const color = tone === 'good'
    ? theme.colors.active
    : tone === 'warn'
      ? theme.colors.warning
      : theme.colors.accent;

  return (
    <article style={{
      border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.radius.lg,
      background: theme.colors.surface,
      padding: '12px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
    }}>
      <span style={{
        fontFamily: theme.font.display,
        fontSize: '10px',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: theme.colors.textSecondary,
      }}>
        {label}
      </span>
      <strong style={{
        fontFamily: theme.font.mono,
        fontSize: '20px',
        color,
        fontWeight: theme.fontWeight.bold,
      }}>
        {value}
      </strong>
      <span style={{
        fontFamily: theme.font.sans,
        fontSize: theme.fontSize.sm,
        color: theme.colors.muted,
      }}>
        {hint}
      </span>
    </article>
  );
}

function DeployModal({ onClose, onSuccess }: DeployModalProps): JSX.Element {
  const navigate = useNavigate();
  const [repoUrl, setRepoUrl] = useState('');
  const [provider, setProvider] = useState('anthropic');
  const [model, setModel] = useState('claude-sonnet-4-6');
  const [phase, setPhase] = useState<'form' | 'cloning' | 'error'>('form');
  const [error, setError] = useState('');
  const [logLines, setLogLines] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const slug = deriveSlug(repoUrl);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logLines]);

  useEffect(() => {
    return () => wsRef.current?.close();
  }, []);

  const startDeploy = async (): Promise<void> => {
    if (!repoUrl.trim()) return;

    setError('');
    setLogLines([]);

    try {
      const project = await createProject({ repoUrl: repoUrl.trim(), provider, model });
      setPhase('cloning');

      const ws = new WebSocket(wsUrl(`/api/projects/${project.id}/clone/stream`));
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as {
            type: string;
            line?: string;
            success?: boolean;
            error?: string;
          };

          if (msg.type === 'progress' && msg.line) {
            setLogLines((prev) => [...prev, msg.line!]);
            return;
          }

          if (msg.type === 'done') {
            ws.close();
            if (msg.success) {
              onSuccess();
              navigate(`/projects/${project.id}`);
              return;
            }
            setError(msg.error ?? 'Clone failed.');
            setPhase('error');
          }
        } catch {
          // Ignore malformed stream lines.
        }
      };

      ws.onerror = () => {
        setError('Clone stream connection failed.');
        setPhase('error');
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project.');
      setPhase('error');
    }
  };

  return (
    <div
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '18px',
        background: 'rgba(4, 9, 12, 0.75)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <div style={{
        width: 'min(600px, 95vw)',
        border: `1px solid ${theme.colors.borderStrong}`,
        borderRadius: theme.radius.lg,
        background: theme.colors.surface,
        boxShadow: `0 20px 50px rgba(0,0,0,0.55), ${theme.shadow.glow}`,
        padding: '18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
      }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{
              fontFamily: theme.font.display,
              color: theme.colors.text,
              fontSize: theme.fontSize.lg,
              margin: 0,
              letterSpacing: '0.04em',
            }}>
              Deploy New Project
            </h2>
            <p style={{
              margin: '4px 0 0',
              color: theme.colors.textSecondary,
              fontFamily: theme.font.sans,
              fontSize: theme.fontSize.sm,
            }}>
              Paste a GitHub repository URL and pick the model.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radius.md,
              background: 'none',
              color: theme.colors.muted,
              fontFamily: theme.font.display,
              fontSize: '11px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '4px 8px',
            }}
          >
            Close
          </button>
        </header>

        {(phase === 'form' || phase === 'error') && (
          <>
            <div>
              <label style={{
                display: 'block',
                fontFamily: theme.font.display,
                fontSize: '10px',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: theme.colors.textSecondary,
                marginBottom: '6px',
              }}>
                Repository URL
              </label>
              <input
                value={repoUrl}
                onChange={(event) => setRepoUrl(event.target.value)}
                placeholder="https://github.com/owner/repo"
                autoFocus
                style={{
                  width: '100%',
                  background: theme.colors.bg,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.radius.md,
                  padding: '9px 10px',
                  color: theme.colors.text,
                  fontFamily: theme.font.mono,
                  fontSize: theme.fontSize.sm,
                  outline: 'none',
                }}
              />
              {slug && (
                <div style={{
                  marginTop: '5px',
                  fontFamily: theme.font.mono,
                  fontSize: '10px',
                  color: theme.colors.muted,
                }}>
                  ID preview: {slug}
                </div>
              )}
            </div>

            <div>
              <label style={{
                display: 'block',
                fontFamily: theme.font.display,
                fontSize: '10px',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: theme.colors.textSecondary,
                marginBottom: '6px',
              }}>
                Model
              </label>
              <ModelSelector
                provider={provider}
                model={model}
                onChange={(nextProvider, nextModel) => {
                  setProvider(nextProvider);
                  setModel(nextModel);
                }}
              />
            </div>

            {phase === 'error' && (
              <div style={{
                padding: '8px 10px',
                border: `1px solid ${theme.colors.danger}60`,
                borderRadius: theme.radius.md,
                background: `${theme.colors.danger}20`,
                color: theme.colors.danger,
                fontFamily: theme.font.sans,
                fontSize: theme.fontSize.sm,
              }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={onClose}
                style={{
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.radius.md,
                  background: 'none',
                  color: theme.colors.textSecondary,
                  padding: '7px 12px',
                  fontFamily: theme.font.display,
                  fontSize: '11px',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => void startDeploy()}
                disabled={!repoUrl.trim()}
                style={{
                  border: 'none',
                  borderRadius: theme.radius.md,
                  background: repoUrl.trim() ? theme.colors.accent : theme.colors.muted,
                  color: theme.colors.bg,
                  opacity: repoUrl.trim() ? 1 : 0.5,
                  padding: '7px 12px',
                  fontFamily: theme.font.display,
                  fontSize: '11px',
                  fontWeight: theme.fontWeight.bold,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                {phase === 'error' ? 'Retry Deploy' : 'Deploy'}
              </button>
            </div>
          </>
        )}

        {phase === 'cloning' && (
          <div style={{
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.md,
            background: theme.colors.bg,
            padding: '10px',
            maxHeight: '260px',
            overflowY: 'auto',
            fontFamily: theme.font.mono,
            fontSize: '11px',
            color: theme.colors.textSecondary,
          }}>
            {logLines.length === 0 ? <div>Preparing clone process...</div> : logLines.map((line, index) => (
              <div key={`${line}-${index}`}>{line}</div>
            ))}
            <div ref={logEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function Dashboard({ showNewProject }: DashboardProps): JSX.Element {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(showNewProject ?? false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [compactLayout, setCompactLayout] = useState<boolean>(window.innerWidth < 1100);

  const loadProjects = useCallback(async (): Promise<void> => {
    try {
      const data = await listProjects();
      setProjects(data);
      setLastRefresh(new Date());
    } catch {
      // Keep previous data if refresh fails.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
    const timer = setInterval(() => void loadProjects(), REFRESH_INTERVAL);
    return () => clearInterval(timer);
  }, [loadProjects]);

  useEffect(() => {
    if (showNewProject) setShowModal(true);
  }, [showNewProject]);

  useEffect(() => {
    const onResize = (): void => setCompactLayout(window.innerWidth < 1100);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const counts = useMemo(() => {
    const active = projects.filter((project) => project.status === 'active').length;
    const cloning = projects.filter((project) => project.status === 'cloning').length;
    const ready = projects.length - active - cloning;
    const autoRenew = projects.filter((project) => project.session?.autoRenew).length;
    const scheduled = projects.filter((project) => project.schedule.enabled && project.schedule.ranges.length > 0).length;
    const uniqueModels = new Set(projects.map((project) => project.model)).size;

    const expiringSoonProjects = projects
      .filter((project) => project.session)
      .map((project) => ({
        id: project.id,
        name: project.name,
        remainingMs: new Date(project.session!.expiresAt).getTime() - Date.now(),
      }))
      .filter((item) => item.remainingMs <= EXPIRING_SOON_MS)
      .sort((a, b) => a.remainingMs - b.remainingMs);

    const healthScoreRaw = projects.length === 0
      ? 100
      : 100 - (cloning * 8) - (expiringSoonProjects.length * 10) + (autoRenew * 3);
    const healthScore = Math.max(0, Math.min(100, Math.round(healthScoreRaw)));

    return {
      active,
      cloning,
      ready,
      autoRenew,
      scheduled,
      uniqueModels,
      expiringSoonProjects,
      healthScore,
    };
  }, [projects]);

  const modelUsage = useMemo(() => {
    const map = new Map<string, number>();
    projects.forEach((project) => {
      map.set(project.model, (map.get(project.model) ?? 0) + 1);
    });
    const rows = Array.from(map.entries()).map(([model, count]) => ({ model, count }));
    rows.sort((a, b) => b.count - a.count);
    return rows;
  }, [projects]);

  const maxModelCount = modelUsage[0]?.count ?? 1;

  return (
    <div style={{
      maxWidth: theme.maxWidth,
      margin: '0 auto',
      padding: `${theme.spacing.xl}`,
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
      animation: 'fadeUp 0.24s ease both',
    }}>
      <header style={{
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.radius.lg,
        background: `linear-gradient(135deg, ${theme.colors.surface} 0%, ${theme.colors.bg} 100%)`,
        padding: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap',
      }}>
        <div>
          <h1 style={{
            margin: 0,
            fontFamily: theme.font.display,
            fontSize: theme.fontSize.xl,
            fontWeight: theme.fontWeight.bold,
            letterSpacing: '0.03em',
            color: theme.colors.text,
          }}>
            Operations Dashboard
          </h1>
          <p style={{
            margin: '5px 0 0',
            fontFamily: theme.font.sans,
            fontSize: theme.fontSize.sm,
            color: theme.colors.textSecondary,
          }}>
            Manage cloned repositories, live sessions, expiry risk, and activity flow from one place.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontFamily: theme.font.mono,
            fontSize: '11px',
            color: theme.colors.muted,
          }}>
            Updated {lastRefresh.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <button
            onClick={() => void loadProjects()}
            style={{
              border: `1px solid ${theme.colors.borderStrong}`,
              borderRadius: theme.radius.md,
              background: `${theme.colors.bg}A0`,
              color: theme.colors.textSecondary,
              padding: '7px 10px',
              fontFamily: theme.font.display,
              fontSize: '11px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            Refresh
          </button>
          <button
            onClick={() => {
              setShowModal(true);
              navigate('/projects/new', { replace: true });
            }}
            style={{
              border: 'none',
              borderRadius: theme.radius.md,
              background: theme.colors.accent,
              color: theme.colors.bg,
              padding: '7px 12px',
              fontFamily: theme.font.display,
              fontSize: '11px',
              fontWeight: theme.fontWeight.bold,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            + Deploy
          </button>
        </div>
      </header>

      <section style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
        gap: '10px',
      }}>
        <MetricCard label="Projects" value={projects.length} hint={`${counts.ready} ready`} />
        <MetricCard label="Active Sessions" value={counts.active} hint="Running Claude sessions" tone="good" />
        <MetricCard label="Health Score" value={`${counts.healthScore}%`} hint="Derived from clone and TTL risk" tone={counts.healthScore >= 75 ? 'good' : 'warn'} />
        <MetricCard label="Expiring Soon" value={counts.expiringSoonProjects.length} hint="Less than 45 min left" tone={counts.expiringSoonProjects.length > 0 ? 'warn' : 'good'} />
        <MetricCard label="Auto-Renew" value={counts.autoRenew} hint="Sessions protected from expiry" />
        <MetricCard label="Models" value={counts.uniqueModels} hint={`${counts.scheduled} with schedule enabled`} />
      </section>

      <section style={{
        display: 'grid',
        gridTemplateColumns: compactLayout ? '1fr' : 'minmax(0, 2fr) minmax(320px, 1fr)',
        gap: '14px',
        alignItems: 'start',
      }}>
        <div style={{
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.radius.lg,
          background: theme.colors.surface,
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontFamily: theme.font.display,
              fontSize: '11px',
              fontWeight: theme.fontWeight.bold,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: theme.colors.text,
            }}>
              Project Fleet ({projects.length})
            </span>
            {loading && (
              <span style={{
                fontFamily: theme.font.mono,
                fontSize: '10px',
                color: theme.colors.warning,
              }}>
                Loading...
              </span>
            )}
          </header>

          {projects.length === 0 && !loading ? (
            <div style={{
              border: `1px dashed ${theme.colors.borderStrong}`,
              borderRadius: theme.radius.md,
              padding: '20px 14px',
              textAlign: 'center',
              color: theme.colors.muted,
              fontFamily: theme.font.sans,
              fontSize: theme.fontSize.sm,
            }}>
              No projects deployed yet.
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
              gap: '10px',
            }}>
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} onRefresh={() => void loadProjects()} />
              ))}
            </div>
          )}
        </div>

        <aside style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}>
          <article style={{
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.lg,
            background: theme.colors.surface,
            padding: '12px',
          }}>
            <h3 style={{
              margin: '0 0 10px',
              fontFamily: theme.font.display,
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: theme.colors.textSecondary,
            }}>
              Model Distribution
            </h3>

            {modelUsage.length === 0 ? (
              <div style={{ color: theme.colors.muted, fontFamily: theme.font.sans, fontSize: theme.fontSize.sm }}>
                No model data yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                {modelUsage.map((row) => (
                  <div key={row.model}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '3px',
                      gap: '8px',
                    }}>
                      <span style={{
                        fontFamily: theme.font.mono,
                        fontSize: '11px',
                        color: theme.colors.text,
                      }}>
                        {row.model.replace(/^claude-/, '')}
                      </span>
                      <span style={{
                        fontFamily: theme.font.mono,
                        fontSize: '10px',
                        color: theme.colors.muted,
                      }}>
                        {row.count}
                      </span>
                    </div>
                    <div style={{
                      height: '6px',
                      borderRadius: theme.radius.full,
                      background: `${theme.colors.bg}AA`,
                      overflow: 'hidden',
                    }}>
                      <span style={{
                        display: 'block',
                        width: `${(row.count / maxModelCount) * 100}%`,
                        height: '100%',
                        borderRadius: theme.radius.full,
                        background: theme.colors.accent,
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article style={{
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.lg,
            background: theme.colors.surface,
            padding: '12px',
          }}>
            <h3 style={{
              margin: '0 0 10px',
              fontFamily: theme.font.display,
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: theme.colors.textSecondary,
            }}>
              Expiry Risk
            </h3>

            {counts.expiringSoonProjects.length === 0 ? (
              <div style={{ color: theme.colors.active, fontFamily: theme.font.sans, fontSize: theme.fontSize.sm }}>
                No session near expiry.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {counts.expiringSoonProjects.slice(0, 6).map((project: ExpiringProject) => (
                  <div key={project.id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '8px',
                    borderBottom: `1px solid ${theme.colors.border}`,
                    paddingBottom: '6px',
                  }}>
                    <span style={{
                      fontFamily: theme.font.display,
                      fontSize: '11px',
                      color: theme.colors.text,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {project.name}
                    </span>
                    <span style={{
                      fontFamily: theme.font.mono,
                      fontSize: '10px',
                      color: project.remainingMs <= 0 ? theme.colors.danger : theme.colors.warning,
                    }}>
                      {formatDuration(project.remainingMs)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </article>

          <EventFeed />
        </aside>
      </section>

      {showModal && (
        <DeployModal
          onClose={() => {
            setShowModal(false);
            navigate('/', { replace: true });
          }}
          onSuccess={() => void loadProjects()}
        />
      )}
    </div>
  );
}

