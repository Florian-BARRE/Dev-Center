// ====== Code Summary ======
// Settings page in a single-flow layout: defaults, global rules, and auth in one screen.

import React, { useEffect, useRef, useState } from 'react';
import { wsUrl } from '../../api/client';
import { getAuthStatus, postLogin } from '../../api/auth';
import { listProjects } from '../../api/projects';
import { getRules } from '../../api/rules';
import { getGlobalRules, getSettings, putGlobalRules, putSettings } from '../../api/settings';
import type { AuthStatusResponse, GlobalConfigResponse, ScheduleConfig } from '../../api/types';
import ModelSelector from '../../components/ModelSelector';
import ScheduleEditor from '../../components/ScheduleEditor';
import theme from '../../theme';

const cardStyle: React.CSSProperties = {
  background: theme.colors.surface,
  border: `1px solid ${theme.colors.border}`,
  borderRadius: theme.radius.lg,
  padding: '14px',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: theme.font.display,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.bold,
  color: theme.colors.textSecondary,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '6px',
};

const inputStyle: React.CSSProperties = {
  background: theme.colors.bg,
  border: `1px solid ${theme.colors.border}`,
  borderRadius: theme.radius.md,
  color: theme.colors.text,
  fontFamily: theme.font.mono,
  fontSize: theme.fontSize.sm,
  padding: '7px 10px',
  width: '120px',
  outline: 'none',
};

function SectionBlock({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <section id={id} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <header>
        <h2 style={{
          margin: 0,
          fontFamily: theme.font.display,
          fontSize: theme.fontSize.lg,
          color: theme.colors.text,
          letterSpacing: '0.02em',
        }}>
          {title}
        </h2>
        <p style={{
          margin: '4px 0 0',
          color: theme.colors.textSecondary,
          fontFamily: theme.font.sans,
          fontSize: theme.fontSize.sm,
        }}>
          {description}
        </p>
      </header>
      {children}
    </section>
  );
}

function DefaultsSection(): JSX.Element {
  const [config, setConfig] = useState<GlobalConfigResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getSettings().then(setConfig).catch(() => {});
  }, []);

  const save = async (): Promise<void> => {
    if (!config || saving) return;

    setSaving(true);
    setSaved(false);
    try {
      const updated = await putSettings(config);
      setConfig(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2_000);
    } finally {
      setSaving(false);
    }
  };

  if (!config) {
    return (
      <div style={{ ...cardStyle, color: theme.colors.muted, fontFamily: theme.font.sans, fontSize: theme.fontSize.sm }}>
        Loading defaults...
      </div>
    );
  }

  const updateSchedule = (schedule: ScheduleConfig): void => setConfig({ ...config, schedule });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={cardStyle}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Default Model</label>
            <ModelSelector
              provider={config.defaults.defaultProvider}
              model={config.defaults.defaultModel}
              onChange={(provider, model) =>
                setConfig({
                  ...config,
                  defaults: { ...config.defaults, defaultProvider: provider, defaultModel: model },
                })
              }
            />
          </div>
          <div>
            <label style={labelStyle}>Default TTL (hours)</label>
            <input
              type="number"
              min={1}
              max={48}
              value={config.defaults.defaultTtlHours}
              onChange={(event) =>
                setConfig({
                  ...config,
                  defaults: {
                    ...config.defaults,
                    defaultTtlHours: parseInt(event.target.value, 10) || 8,
                  },
                })
              }
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Renew threshold (minutes)</label>
            <input
              type="number"
              min={5}
              max={120}
              value={config.defaults.renewThresholdMinutes}
              onChange={(event) =>
                setConfig({
                  ...config,
                  defaults: {
                    ...config.defaults,
                    renewThresholdMinutes: parseInt(event.target.value, 10) || 30,
                  },
                })
              }
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ ...labelStyle, marginBottom: '10px' }}>Global Schedule</div>
        <ScheduleEditor value={config.schedule} onChange={updateSchedule} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={() => void save()}
          disabled={saving}
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
            opacity: saving ? 0.5 : 1,
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Saving...' : 'Save Defaults'}
        </button>
        {saved && (
          <span style={{ color: theme.colors.active, fontFamily: theme.font.sans, fontSize: theme.fontSize.sm }}>
            Saved
          </span>
        )}
      </div>
    </div>
  );
}

function GlobalRulesSection(): JSX.Element {
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [outOfSyncCount, setOutOfSyncCount] = useState(0);

  useEffect(() => {
    getGlobalRules().then(setContent).catch(() => {});

    listProjects().then(async (projects) => {
      const syncFlags = await Promise.all(
        projects.map((project) =>
          getRules(project.id)
            .then((response) => response.globalRulesOutOfSync)
            .catch(() => false)
        )
      );
      setOutOfSyncCount(syncFlags.filter(Boolean).length);
    }).catch(() => {});
  }, []);

  const save = async (): Promise<void> => {
    if (saving) return;

    setSaving(true);
    setSaved(false);
    try {
      const updated = await putGlobalRules(content);
      setContent(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2_000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: theme.font.sans, fontSize: theme.fontSize.sm, color: theme.colors.muted }}>
            This block is injected at the top of every project CLAUDE.md.
          </span>
          {outOfSyncCount > 0 && (
            <span style={{
              background: `${theme.colors.warning}33`,
              border: `1px solid ${theme.colors.warning}66`,
              borderRadius: theme.radius.full,
              color: theme.colors.warning,
              fontFamily: theme.font.display,
              fontSize: '10px',
              fontWeight: theme.fontWeight.bold,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              padding: '2px 8px',
            }}>
              {outOfSyncCount} out of sync
            </span>
          )}
        </div>

        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          style={{
            width: '100%',
            minHeight: '300px',
            background: theme.colors.bg,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.md,
            color: theme.colors.text,
            fontFamily: theme.font.mono,
            fontSize: theme.fontSize.sm,
            padding: '10px',
            resize: 'vertical',
            boxSizing: 'border-box',
            outline: 'none',
          }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={() => void save()}
          disabled={saving}
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
            opacity: saving ? 0.5 : 1,
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Saving...' : 'Save Global Rules'}
        </button>
        {saved && (
          <span style={{ color: theme.colors.active, fontFamily: theme.font.sans, fontSize: theme.fontSize.sm }}>
            Saved
          </span>
        )}
      </div>
    </div>
  );
}

function AuthSection(): JSX.Element {
  const [status, setStatus] = useState<AuthStatusResponse | null>(null);
  const [showStream, setShowStream] = useState(false);
  const [streamLines, setStreamLines] = useState<string[]>([]);
  const [streamDone, setStreamDone] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    getAuthStatus().then(setStatus).catch(() => {});
  }, []);

  const startLogin = async (): Promise<void> => {
    try {
      await postLogin();
      setShowStream(true);
      setStreamDone(false);
      setStreamLines([]);

      const ws = new WebSocket(wsUrl('/api/auth/login/stream'));
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as {
            line?: string;
            done?: boolean;
            success?: boolean;
          };

          if (msg.line !== undefined) {
            setStreamLines((prev) => [...prev, msg.line!]);
          }

          if (msg.done) {
            setStreamDone(true);
            ws.close();
            if (msg.success) {
              getAuthStatus().then(setStatus).catch(() => {});
            }
          }
        } catch {
          // Ignore malformed lines.
        }
      };

      ws.onerror = () => {
        setStreamDone(true);
        ws.close();
      };
    } catch {
      // Ignore action errors.
    }
  };

  useEffect(() => {
    return () => wsRef.current?.close();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={cardStyle}>
        {status ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{
              color: status.authenticated ? theme.colors.active : theme.colors.danger,
              fontFamily: theme.font.display,
              fontSize: theme.fontSize.base,
              fontWeight: theme.fontWeight.bold,
              letterSpacing: '0.04em',
            }}>
              {status.authenticated ? 'Authenticated' : 'Not Authenticated'}
            </span>
            {status.email && (
              <span style={{ color: theme.colors.muted, fontFamily: theme.font.mono, fontSize: theme.fontSize.sm }}>
                {status.email}
              </span>
            )}
          </div>
        ) : (
          <div style={{ color: theme.colors.muted, fontFamily: theme.font.sans, fontSize: theme.fontSize.sm }}>
            Loading auth status...
          </div>
        )}
      </div>

      <div>
        <button
          onClick={() => void startLogin()}
          style={{
            border: `1px solid ${theme.colors.borderStrong}`,
            borderRadius: theme.radius.md,
            background: `${theme.colors.bg}A0`,
            color: theme.colors.text,
            padding: '7px 12px',
            fontFamily: theme.font.display,
            fontSize: '11px',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          {status?.authenticated ? 'Re-authenticate' : 'Authenticate'}
        </button>
      </div>

      {showStream && (
        <div style={cardStyle}>
          <div style={{
            marginBottom: '8px',
            fontFamily: theme.font.display,
            fontSize: '10px',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: theme.colors.textSecondary,
          }}>
            Auth Stream {streamDone ? '(Done)' : ''}
          </div>
          <div style={{
            background: theme.colors.bg,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.md,
            padding: '10px',
            maxHeight: '200px',
            overflowY: 'auto',
            fontFamily: theme.font.mono,
            fontSize: '11px',
            color: theme.colors.textSecondary,
            whiteSpace: 'pre-wrap',
          }}>
            {streamLines.length === 0 ? (
              <span style={{ color: theme.colors.muted }}>Waiting for auth output...</span>
            ) : (
              streamLines.map((line, index) => <div key={`${line}-${index}`}>{line}</div>)
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage(): JSX.Element {
  const scrollToSection = (id: string): void => {
    const element = document.getElementById(id);
    element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div style={{
      maxWidth: theme.maxWidth,
      margin: '0 auto',
      padding: `${theme.spacing.xl}`,
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      animation: 'fadeUp 0.22s ease both',
    }}>
      <header style={{
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.radius.lg,
        background: `linear-gradient(135deg, ${theme.colors.surface} 0%, ${theme.colors.bg} 100%)`,
        padding: '16px',
      }}>
        <h1 style={{
          margin: 0,
          fontFamily: theme.font.display,
          fontSize: theme.fontSize.xl,
          fontWeight: theme.fontWeight.bold,
          color: theme.colors.text,
          letterSpacing: '0.03em',
        }}>
          Settings
        </h1>
        <p style={{
          margin: '5px 0 0',
          color: theme.colors.textSecondary,
          fontFamily: theme.font.sans,
          fontSize: theme.fontSize.sm,
        }}>
          All operational configuration in one page: defaults, global rules, and authentication.
        </p>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
          {[
            { id: 'defaults', label: 'Defaults' },
            { id: 'global-rules', label: 'Global Rules' },
            { id: 'auth', label: 'Auth' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => scrollToSection(item.id)}
              style={{
                border: `1px solid ${theme.colors.borderStrong}`,
                borderRadius: theme.radius.md,
                background: `${theme.colors.bg}A0`,
                color: theme.colors.textSecondary,
                padding: '6px 10px',
                fontFamily: theme.font.display,
                fontSize: '11px',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      <SectionBlock
        id="defaults"
        title="Defaults"
        description="Baseline model, session lifetime, and schedule used when project-level settings are not overriding it."
      >
        <DefaultsSection />
      </SectionBlock>

      <SectionBlock
        id="global-rules"
        title="Global Rules"
        description="Central CLAUDE.md instructions injected into every project."
      >
        <GlobalRulesSection />
      </SectionBlock>

      <SectionBlock
        id="auth"
        title="Authentication"
        description="Check current Claude login and run re-authentication when needed."
      >
        <AuthSection />
      </SectionBlock>
    </div>
  );
}

