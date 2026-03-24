// ====== Code Summary ======
// App root — top navigation bar, auth warning banner, and route definitions.

import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import theme from './theme';
import { getAuthStatus } from './api/auth';
import Dashboard from './pages/Dashboard/Dashboard';
import ProjectPage from './pages/Project/ProjectPage';
import MonitoringPage from './pages/Monitoring/MonitoringPage';
import SettingsPage from './pages/Settings/SettingsPage';

// Auth context shared via prop drilling (small app, no context needed)
const AUTH_POLL_INTERVAL = 30_000;

function TopNav() {
  const navigate = useNavigate();
  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0,
      height: theme.nav.height,
      background: theme.colors.nav,
      borderBottom: `1px solid ${theme.colors.navBorder}`,
      display: 'flex', alignItems: 'center',
      padding: '0 24px', gap: '32px', zIndex: 100,
    }}>
      <span style={{
        fontFamily: theme.font.sans,
        fontWeight: theme.fontWeight.semibold,
        fontSize: theme.fontSize.md,
        color: theme.colors.text,
        letterSpacing: '-0.02em',
        marginRight: '8px',
      }}>
        Dev Center
      </span>

      <div style={{ display: 'flex', gap: '24px', flex: 1 }}>
        {(['/', '/monitoring', '/settings'] as const).map((path) => (
          <NavLink key={path} to={path} end={path === '/'} style={({ isActive }) => ({
            fontFamily: theme.font.sans,
            fontSize: theme.fontSize.sm,
            fontWeight: theme.fontWeight.medium,
            color: isActive ? theme.colors.text : theme.colors.textSecondary,
            textDecoration: 'none',
            borderBottom: isActive ? `2px solid ${theme.colors.text}` : '2px solid transparent',
            paddingBottom: '2px',
          })}>
            {path === '/' ? 'Home' : path === '/monitoring' ? 'Monitoring' : 'Settings'}
          </NavLink>
        ))}
      </div>

      <button
        onClick={() => navigate('/projects/new')}
        style={{
          fontFamily: theme.font.sans,
          fontSize: theme.fontSize.sm,
          fontWeight: theme.fontWeight.medium,
          background: theme.colors.accent,
          color: theme.colors.bg,
          border: 'none',
          borderRadius: theme.radius.sm,
          padding: '6px 12px',
          cursor: 'pointer',
        }}
      >
        + New Project
      </button>
    </nav>
  );
}

function AuthBanner() {
  return (
    <div style={{
      position: 'fixed', top: theme.nav.height, left: 0, right: 0,
      background: theme.colors.warning + '22',
      border: `1px solid ${theme.colors.warning}44`,
      borderTop: 'none',
      padding: '6px 24px',
      display: 'flex', alignItems: 'center', gap: '12px',
      zIndex: 99,
      fontFamily: theme.font.sans, fontSize: theme.fontSize.sm,
      color: theme.colors.warning,
    }}>
      <span>⚠</span>
      <span>Claude is not authenticated. Go to <a href="/settings" style={{ color: theme.colors.warning }}>Settings → Auth</a> to log in.</span>
    </div>
  );
}

function AppContent() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const check = async () => {
      try {
        const status = await getAuthStatus();
        setAuthenticated(status.authenticated);
      } catch {
        setAuthenticated(true); // don't show banner on API errors
      }
    };
    check();
    const id = setInterval(check, AUTH_POLL_INTERVAL);
    return () => clearInterval(id);
  }, []);

  const bannerOffset = authenticated === false ? '28px' : '0px';

  return (
    <>
      <TopNav />
      {authenticated === false && <AuthBanner />}
      <main style={{
        marginTop: `calc(${theme.nav.height} + ${bannerOffset})`,
        minHeight: `calc(100vh - ${theme.nav.height})`,
        background: theme.colors.bg,
      }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/projects/new" element={<Dashboard showNewProject />} />
          <Route path="/projects/:projectId/*" element={<ProjectPage />} />
          <Route path="/monitoring" element={<MonitoringPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
