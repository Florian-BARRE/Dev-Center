// ====== Code Summary ======
// App root — top navigation bar + main content area. No sidebar.

import React from 'react';
import { BrowserRouter, Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import theme from './theme';
import LogConsole from './components/LogConsole';
import Dashboard from './pages/Dashboard/Dashboard';
import MonitoringPage from './pages/Monitoring/MonitoringPage';
import ProjectPage from './pages/Project/ProjectPage';
import SettingsPage from './pages/GlobalSettings/SettingsPage';
import NewProjectPage from './pages/NewProject/NewProjectPage';

const navLinkStyle = ({ isActive }: { isActive: boolean }): React.CSSProperties => ({
  fontFamily: theme.font.sans,
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.medium,
  color: isActive ? theme.colors.text : theme.colors.textSecondary,
  textDecoration: 'none',
  borderBottom: isActive ? `2px solid ${theme.colors.text}` : '2px solid transparent',
  paddingBottom: '2px',
  transition: 'color 0.15s',
});

function TopNav() {
  const navigate = useNavigate();
  return (
    <nav style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: theme.nav.height,
      background: theme.colors.nav,
      borderBottom: `1px solid ${theme.colors.navBorder}`,
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      gap: '32px',
      zIndex: 100,
    }}>
      {/* Logo */}
      <span style={{
        fontFamily: theme.font.sans,
        fontWeight: theme.fontWeight.semibold,
        fontSize: theme.fontSize.md,
        color: theme.colors.text,
        letterSpacing: '-0.02em',
        marginRight: '8px',
      }}>
        IDH
      </span>

      {/* Nav links */}
      <div style={{ display: 'flex', gap: '24px', flex: 1 }}>
        <NavLink to="/" end style={navLinkStyle}>Home</NavLink>
        <NavLink to="/monitoring" style={navLinkStyle}>Monitoring</NavLink>
        <NavLink to="/settings" style={navLinkStyle}>Settings</NavLink>
      </div>

      {/* New Project button */}
      <button
        onClick={() => navigate('/projects/new')}
        style={{
          fontFamily: theme.font.sans,
          fontSize: theme.fontSize.sm,
          fontWeight: theme.fontWeight.medium,
          background: theme.colors.accent,
          color: '#000',
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

function AppContent() {
  return (
    <>
      <TopNav />
      <main style={{
        marginTop: theme.nav.height,
        minHeight: `calc(100vh - ${theme.nav.height})`,
        background: theme.colors.bg,
      }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/monitoring" element={<MonitoringPage />} />
          <Route path="/projects/new" element={<NewProjectPage />} />
          <Route path="/projects/:groupId/*" element={<ProjectPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
      <LogConsole />
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
