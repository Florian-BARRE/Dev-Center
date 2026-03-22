import { useEffect, useState } from 'react';
import { useParams, useNavigate, useMatch } from 'react-router-dom';
import { theme } from '../../theme';
import { getProject } from '../../api/projects';
import type { Project } from '../../api/types';
import StatusBadge from '../../components/StatusBadge';
import OverviewTab from './tabs/OverviewTab';
import TelegramTab from './tabs/TelegramTab';
import CodeSessionTab from './tabs/CodeSessionTab';

type Tab = 'overview' | 'telegram' | 'code-session';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'overview',     label: 'Overview',      icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { id: 'telegram',     label: 'Telegram',       icon: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z' },
  { id: 'code-session', label: 'Code Session',   icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
];

export default function ProjectPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const decodedGroupId = decodeURIComponent(groupId ?? '');
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 1. Determine active tab from URL
  const baseUrl = `/projects/${encodeURIComponent(decodedGroupId)}`;
  const telegramMatch    = useMatch(`${baseUrl}/telegram`);
  const codeSessionMatch = useMatch(`${baseUrl}/code-session/*`);

  const activeTab: Tab =
    telegramMatch    ? 'telegram' :
    codeSessionMatch ? 'code-session' :
    'overview';

  // 2. Load project on mount
  useEffect(() => {
    if (!decodedGroupId) return;
    getProject(decodedGroupId)
      .then((p) => { setProject(p); setLoading(false); })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, [decodedGroupId]);

  const goToTab = (tab: Tab) => {
    if (tab === 'overview') navigate(baseUrl);
    else navigate(`${baseUrl}/${tab}`);
  };

  if (loading) {
    return (
      <div style={{ padding: theme.spacing.xl }}>
        <div style={{ height: '40px', width: '200px', background: theme.colors.surface, borderRadius: theme.radius.md, opacity: 0.5 }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: theme.spacing.xl }}>
        <div style={{ padding: theme.spacing.lg, background: theme.colors.dangerBg, border: `1px solid ${theme.colors.danger}44`, borderRadius: theme.radius.md, color: theme.colors.danger }}>
          {error}
        </div>
      </div>
    );
  }

  if (!project) return null;

  const isActive = project.bridge !== null;

  return (
    <div style={{ padding: theme.spacing.xl }}>
      {/* Page header */}
      <div style={{ marginBottom: theme.spacing.xl }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: theme.radius.md,
            background: theme.colors.surfaceElevated, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: theme.font.size.md, fontWeight: theme.font.weight.bold,
            color: theme.colors.primary, fontFamily: theme.font.mono, flexShrink: 0,
          }}>
            {project.projectId.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
              <h1 style={{ margin: 0, fontSize: theme.font.size.xxl, fontWeight: theme.font.weight.bold }}>
                {project.projectId}
              </h1>
              <StatusBadge status={isActive ? 'active' : 'idle'} />
            </div>
            <div style={{ marginTop: '2px', fontSize: theme.font.size.xs, color: theme.colors.muted, fontFamily: theme.font.mono }}>
              {project.groupId}
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '2px', borderBottom: `1px solid ${theme.colors.border}`, marginBottom: theme.spacing.xl }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => goToTab(t.id)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: theme.spacing.xs,
              background: 'none', border: 'none', cursor: 'pointer',
              padding: `${theme.spacing.sm} ${theme.spacing.md}`,
              fontSize: theme.font.size.sm,
              fontWeight: activeTab === t.id ? theme.font.weight.semibold : theme.font.weight.normal,
              color: activeTab === t.id ? theme.colors.text : theme.colors.muted,
              borderBottom: activeTab === t.id ? `2px solid ${theme.colors.primary}` : '2px solid transparent',
              marginBottom: '-1px', transition: theme.transition.fast,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={t.icon} />
            </svg>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview'     && <OverviewTab    project={project} onProjectChange={setProject} />}
      {activeTab === 'telegram'     && <TelegramTab    project={project} />}
      {activeTab === 'code-session' && <CodeSessionTab project={project} onProjectChange={setProject} />}
    </div>
  );
}
