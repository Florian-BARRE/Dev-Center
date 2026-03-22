import { BrowserRouter, Routes, Route, NavLink, Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { theme } from './theme';
import { listProjects } from './api/projects';
import type { Project } from './api/types';
import Dashboard from './pages/Dashboard/Dashboard';
import ProjectPage from './pages/Project/ProjectPage';
import NewProjectPage from './pages/NewProject/NewProjectPage';
import GlobalSettingsPage from './pages/GlobalSettings/SettingsPage';
import MonitoringPage from './pages/Monitoring/MonitoringPage';

// ── Icon helpers ──────────────────────────────────────────────────────────────

function IconGrid() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  );
}

function IconChart() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  );
}

function IconGear() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}

function IconDot({ active }: { active: boolean }) {
  if (active) {
    return (
      <span style={{
        width: '7px', height: '7px', borderRadius: '50%',
        background: theme.colors.success, display: 'inline-block', flexShrink: 0,
        animation: 'pulse 2s infinite',
      }} />
    );
  }
  return (
    <span style={{
      width: '7px', height: '7px', borderRadius: '50%',
      background: theme.colors.muted, display: 'inline-block', flexShrink: 0,
    }} />
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function Sidebar() {
  const location = useLocation();
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    listProjects()
      .then((res) => setProjects(res.projects))
      .catch(() => {});
  }, [location.pathname]);

  const navItemStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    height: '36px',
    padding: '0 12px 0 14px',
    borderRadius: theme.radius.md,
    fontSize: theme.font.size.md,
    fontFamily: theme.font.sans,
    fontWeight: active ? theme.font.weight.semibold : theme.font.weight.normal,
    color: active ? theme.colors.accent : theme.colors.textSecondary,
    background: active ? theme.colors.accentDim : 'transparent',
    borderLeft: active ? `2px solid ${theme.colors.accent}` : '2px solid transparent',
    boxShadow: active ? `inset 0 0 20px ${theme.colors.accentGlow}` : 'none',
    cursor: 'pointer',
    transition: theme.transition.fast,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  });

  const sectionLabel: React.CSSProperties = {
    fontSize: '10px',
    fontFamily: theme.font.sans,
    fontWeight: theme.font.weight.semibold,
    color: theme.colors.muted,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    padding: '0 16px',
    marginTop: '20px',
    marginBottom: '4px',
  };

  return (
    <div style={{
      position: 'fixed',
      left: 0, top: 0, bottom: 0,
      width: theme.sidebar.width,
      background: theme.colors.surface,
      borderRight: `1px solid ${theme.colors.border}`,
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
      zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ padding: '24px 16px 16px', borderBottom: `1px solid ${theme.colors.border}` }}>
        <div style={{
          fontFamily: theme.font.display,
          fontWeight: theme.font.weight.extrabold,
          fontSize: theme.font.size.xl,
          color: theme.colors.accent,
          letterSpacing: '0.04em',
          lineHeight: 1,
        }}>
          NEXUS
        </div>
        <div style={{
          fontFamily: theme.font.mono,
          fontSize: theme.font.size.xs,
          color: theme.colors.muted,
          marginTop: '4px',
          letterSpacing: '0.08em',
        }}>
          IDH — AI Dev Hub
        </div>
      </div>

      {/* Navigation */}
      <div style={{ flex: 1, padding: '8px 8px' }}>
        <div style={sectionLabel}>Navigation</div>

        <NavLink to="/" end style={({ isActive }) => navItemStyle(isActive)}>
          <IconGrid />
          Dashboard
        </NavLink>

        <NavLink to="/monitoring" style={({ isActive }) => navItemStyle(isActive)}>
          <IconChart />
          Monitoring
        </NavLink>

        <NavLink to="/settings" style={({ isActive }) => navItemStyle(isActive)}>
          <IconGear />
          Settings
        </NavLink>

        {/* Projects section */}
        <div style={sectionLabel}>Projects</div>

        {projects.map((p) => {
          const isActive = p.bridge !== null;
          const href = `/projects/${encodeURIComponent(p.groupId)}`;
          const currentlyActive = location.pathname.startsWith(href);
          return (
            <Link
              key={p.groupId}
              to={href}
              style={navItemStyle(currentlyActive)}
            >
              <IconDot active={isActive} />
              <span style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontFamily: theme.font.mono,
                fontSize: theme.font.size.sm,
              }}>
                {p.projectId}
              </span>
            </Link>
          );
        })}

        <Link
          to="/projects/new"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            height: '32px',
            padding: '0 12px 0 14px',
            borderRadius: theme.radius.md,
            fontSize: theme.font.size.sm,
            fontFamily: theme.font.sans,
            color: theme.colors.muted,
            background: 'transparent',
            border: `1px dashed ${theme.colors.border}`,
            cursor: 'pointer',
            marginTop: '4px',
            textDecoration: 'none',
            transition: theme.transition.fast,
          }}
        >
          <span style={{ fontSize: '16px', lineHeight: 1 }}>+</span>
          New Project
        </Link>
      </div>

      {/* Footer */}
      <div style={{
        padding: '12px 16px',
        borderTop: `1px solid ${theme.colors.border}`,
        fontFamily: theme.font.mono,
        fontSize: theme.font.size.xs,
        color: theme.colors.muted,
      }}>
        v0.1.0
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}

function AppLayout() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{
        marginLeft: theme.sidebar.width,
        flex: 1,
        minHeight: '100vh',
        backgroundColor: theme.colors.bg,
        backgroundImage: 'radial-gradient(circle, #1e1e3a 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/monitoring" element={<MonitoringPage />} />
          <Route path="/projects/new" element={<NewProjectPage />} />
          <Route path="/projects/:groupId/*" element={<ProjectPage />} />
          <Route path="/settings" element={<GlobalSettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}
