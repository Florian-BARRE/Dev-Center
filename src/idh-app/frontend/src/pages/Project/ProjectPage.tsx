import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { theme } from '../../theme';
import { getProject } from '../../api/projects';
import type { Project } from '../../api/types';
import OverviewTab from './tabs/OverviewTab';
import BridgeTab from './tabs/BridgeTab';
import MemoryTab from './tabs/MemoryTab';
import SettingsTab from './tabs/SettingsTab';

type Tab = 'overview' | 'bridge' | 'memory' | 'settings';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'bridge',   label: 'Bridge' },
  { id: 'memory',   label: 'Memory' },
  { id: 'settings', label: 'Settings' },
];

export default function ProjectPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const decodedGroupId = decodeURIComponent(groupId ?? '');
  const [project, setProject] = useState<Project | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!decodedGroupId) return;
    getProject(decodedGroupId)
      .then((p) => { setProject(p); setLoading(false); })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, [decodedGroupId]);

  const tabButtonStyle = (id: Tab) => ({
    background: 'none',
    border: 'none',
    color: tab === id ? theme.colors.text : theme.colors.muted,
    fontFamily: theme.font.mono,
    fontSize: theme.font.size.md,
    cursor: 'pointer',
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    borderBottom: tab === id ? `2px solid ${theme.colors.primary}` : '2px solid transparent',
  });

  return (
    <div style={{ minHeight: '100vh', background: theme.colors.bg, color: theme.colors.text, fontFamily: theme.font.sans, padding: theme.spacing.xl }}>
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>
        <Link to="/" style={{ color: theme.colors.muted, textDecoration: 'none', fontSize: theme.font.size.sm }}>
          ← Dashboard
        </Link>

        {error && <div style={{ color: theme.colors.danger, marginTop: theme.spacing.md }}>{error}</div>}
        {loading && <div style={{ color: theme.colors.muted, marginTop: theme.spacing.md }}>Loading...</div>}

        {project && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md, margin: `${theme.spacing.md} 0` }}>
              <h1 style={{ margin: 0, fontSize: theme.font.size.xxl, fontFamily: theme.font.mono }}>
                {project.projectId}
              </h1>
            </div>

            {/* Tab bar */}
            <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${theme.colors.border}`, marginBottom: theme.spacing.lg }}>
              {TABS.map((t) => (
                <button key={t.id} onClick={() => setTab(t.id)} style={tabButtonStyle(t.id)}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ background: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.lg, padding: theme.spacing.lg }}>
              {tab === 'overview'  && <OverviewTab  project={project} onProjectChange={setProject} />}
              {tab === 'bridge'    && <BridgeTab    project={project} onProjectChange={setProject} />}
              {tab === 'memory'    && <MemoryTab    project={project} />}
              {tab === 'settings'  && <SettingsTab  project={project} />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
