// ====== Code Summary ======
// App shell with navigation, auth warning strip, backend ping status, and route definitions.

import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { getAuthStatus } from './api/auth';
import { getHealth } from './api/health';
import LogBubble from './components/LogBubble';
import theme from './theme';
import Dashboard from './pages/Dashboard/Dashboard';
import ProjectPage from './pages/Project/ProjectPage';
import SettingsPage from './pages/Settings/SettingsPage';

const AUTH_POLL_INTERVAL = 30_000;
const PING_POLL_INTERVAL = 10_000;

function formatUtcOffset(offset: string): string {
  if (!offset || offset.length !== 5) return offset;
  return `${offset.slice(0, 3)}:${offset.slice(3)}`;
}

interface TopNavProps {
  backendClockLabel: string;
  backendZoneLabel: string;
  backendOnline: boolean;
  pingPulseToken: number;
}

function TopNav({
  backendClockLabel,
  backendZoneLabel,
  backendOnline,
  pingPulseToken,
}: TopNavProps): JSX.Element {
  const navigate = useNavigate();
  const indicatorColor = backendOnline ? theme.colors.active : theme.colors.danger;

  return (
    <nav style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 1000,
      height: theme.nav.height,
      display: 'flex',
      alignItems: 'center',
      gap: '14px',
      padding: '0 16px',
      borderBottom: `1px solid ${theme.colors.navBorder}`,
      background: theme.colors.nav,
      backdropFilter: 'blur(18px)',
      WebkitBackdropFilter: 'blur(18px)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span
          key={pingPulseToken}
          style={{
            width: '7px',
            height: '7px',
            borderRadius: theme.radius.full,
            background: indicatorColor,
            boxShadow: `0 0 10px ${indicatorColor}`,
            animation: pingPulseToken > 0 ? 'ping-success 0.45s ease' : 'none',
            opacity: 0.9,
          }}
        />
        <span style={{
          fontFamily: theme.font.mono,
          color: theme.colors.textSecondary,
          fontSize: '11px',
          letterSpacing: '0.02em',
        }}>
          {backendClockLabel}
        </span>
        {backendZoneLabel && (
          <span style={{
            fontFamily: theme.font.mono,
            color: theme.colors.muted,
            fontSize: '10px',
            letterSpacing: '0.02em',
          }}>
            {backendZoneLabel}
          </span>
        )}
      </div>

      <div style={{ width: '1px', height: '18px', background: theme.colors.border, flexShrink: 0 }} />

      <button
        onClick={() => navigate('/')}
        style={{
          border: 'none',
          background: 'none',
          color: theme.colors.text,
          fontFamily: theme.font.display,
          fontWeight: theme.fontWeight.bold,
          fontSize: '13px',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        Dev Center
      </button>

      <div style={{ width: '1px', height: '18px', background: theme.colors.border, flexShrink: 0 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {[
          { to: '/', label: 'Dashboard', end: true },
          { to: '/settings', label: 'Settings' },
        ].map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            style={({ isActive }) => ({
              border: `1px solid ${isActive ? `${theme.colors.accent}66` : 'transparent'}`,
              borderRadius: theme.radius.md,
              padding: '5px 10px',
              textDecoration: 'none',
              fontFamily: theme.font.display,
              fontSize: '11px',
              fontWeight: isActive ? theme.fontWeight.semibold : theme.fontWeight.normal,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: isActive ? theme.colors.accent : theme.colors.textSecondary,
              background: isActive ? theme.colors.accentGlow : 'transparent',
              transition: 'all 0.15s',
            })}
          >
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

function AuthBanner(): JSX.Element {
  return (
    <div style={{
      position: 'fixed',
      top: theme.nav.height,
      left: 0,
      right: 0,
      zIndex: 999,
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '6px 16px',
      background: `${theme.colors.warning}20`,
      borderBottom: `1px solid ${theme.colors.warning}55`,
      color: theme.colors.warning,
      fontFamily: theme.font.display,
      fontSize: '11px',
      letterSpacing: '0.05em',
    }}>
      <span aria-hidden>!</span>
      <span>Claude is not authenticated. Open Settings to connect the account.</span>
    </div>
  );
}

function AppContent(): JSX.Element {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [backendClockOffsetMs, setBackendClockOffsetMs] = useState<number | null>(null);
  const [backendTimezone, setBackendTimezone] = useState('');
  const [backendUtcOffset, setBackendUtcOffset] = useState('');
  const [backendOnline, setBackendOnline] = useState(false);
  const [pingPulseToken, setPingPulseToken] = useState(0);
  const [clientNowMs, setClientNowMs] = useState<number>(Date.now());

  useEffect(() => {
    const checkAuth = async (): Promise<void> => {
      try {
        const status = await getAuthStatus();
        setAuthenticated(status.authenticated);
      } catch {
        setAuthenticated(true);
      }
    };

    checkAuth();
    const timer = setInterval(checkAuth, AUTH_POLL_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const pingBackend = async (): Promise<void> => {
      try {
        const health = await getHealth();
        const serverMs = Date.parse(health.serverTime);

        if (!Number.isNaN(serverMs)) {
          setBackendClockOffsetMs(serverMs - Date.now());
        }

        setBackendTimezone(health.timezone);
        setBackendUtcOffset(health.utcOffset);
        setBackendOnline(true);
        setPingPulseToken((previous) => previous + 1);
      } catch {
        setBackendOnline(false);
      }
    };

    void pingBackend();
    const timer = setInterval(() => void pingBackend(), PING_POLL_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setClientNowMs(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);

  const bannerOffset = authenticated === false ? '30px' : '0px';
  const backendNowMs = backendClockOffsetMs === null ? null : clientNowMs + backendClockOffsetMs;
  const backendClockLabel = backendNowMs === null
    ? '--:--:--'
    : new Date(backendNowMs).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

  const backendZoneLabel = backendTimezone
    ? `${backendTimezone}${backendUtcOffset ? ` (UTC${formatUtcOffset(backendUtcOffset)})` : ''}`
    : '';

  return (
    <>
      <TopNav
        backendClockLabel={backendClockLabel}
        backendZoneLabel={backendZoneLabel}
        backendOnline={backendOnline}
        pingPulseToken={pingPulseToken}
      />
      {authenticated === false && <AuthBanner />}
      <main style={{
        minHeight: `calc(100vh - ${theme.nav.height})`,
        marginTop: `calc(${theme.nav.height} + ${bannerOffset})`,
      }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/projects/new" element={<Dashboard showNewProject />} />
          <Route path="/projects/:projectId/*" element={<ProjectPage />} />
          <Route path="/monitoring" element={<Navigate to="/" replace />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
      <LogBubble />
    </>
  );
}

export default function App(): JSX.Element {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
