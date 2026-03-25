// ====== Code Summary ======
// Settings page — 3 tabs: Defaults, Global Rules, Auth.

import React, { useEffect, useRef, useState } from 'react';
import theme from '../../theme';
import ModelSelector from '../../components/ModelSelector';
import ScheduleEditor from '../../components/ScheduleEditor';
import { getSettings, putSettings, getGlobalRules, putGlobalRules } from '../../api/settings';
import { getAuthStatus, postLogin } from '../../api/auth';
import { listProjects } from '../../api/projects';
import { getRules } from '../../api/rules';
import { wsUrl } from '../../api/client';
import type { GlobalConfigResponse, ScheduleConfig, AuthStatusResponse } from '../../api/types';

type ActiveTab = 'defaults' | 'rules' | 'auth';

// ── Shared styles ──────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: theme.colors.surface,
  border: `1px solid ${theme.colors.border}`,
  borderRadius: theme.radius.md,
  padding: theme.spacing.lg,
  marginBottom: theme.spacing.md,
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: theme.font.sans,
  fontSize: theme.fontSize.xs,
  color: theme.colors.textSecondary,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '6px',
};

const inputStyle: React.CSSProperties = {
  background: theme.colors.bg,
  border: `1px solid ${theme.colors.border}`,
  borderRadius: theme.radius.sm,
  color: theme.colors.text,
  fontFamily: theme.font.mono,
  fontSize: theme.fontSize.sm,
  padding: '6px 10px',
  width: '120px',
  outline: 'none',
};

const saveBtn = (busy: boolean): React.CSSProperties => ({
  background: theme.colors.accent,
  color: theme.colors.bg,
  border: 'none',
  borderRadius: theme.radius.sm,
  padding: '6px 16px',
  fontSize: theme.fontSize.sm,
  fontFamily: theme.font.sans,
  fontWeight: theme.fontWeight.medium,
  cursor: busy ? 'not-allowed' : 'pointer',
  opacity: busy ? 0.6 : 1,
});

// ── Defaults tab ───────────────────────────────────────────────────────────

function DefaultsTab() {
  const [config, setConfig] = useState<GlobalConfigResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { getSettings().then(setConfig).catch(() => {}); }, []);

  const save = async () => {
    if (!config || saving) return;
    setSaving(true);
    setSaved(false);
    try {
      const updated = await putSettings(config);
      setConfig(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2_000);
    } finally { setSaving(false); }
  };

  if (!config) return <div style={{ color: theme.colors.muted, fontFamily: theme.font.sans, fontSize: theme.fontSize.sm }}>Loading…</div>;

  const updateSchedule = (schedule: ScheduleConfig) => setConfig({ ...config, schedule });

  return (
    <div>
      <div style={cardStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
          <div>
            <label style={labelStyle}>Default Model</label>
            <ModelSelector
              provider={config.defaults.defaultProvider}
              model={config.defaults.defaultModel}
              onChange={(provider, model) =>
                setConfig({ ...config, defaults: { ...config.defaults, defaultProvider: provider, defaultModel: model } })
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
              onChange={(e) =>
                setConfig({ ...config, defaults: { ...config.defaults, defaultTtlHours: parseInt(e.target.value) || 8 } })
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
              onChange={(e) =>
                setConfig({ ...config, defaults: { ...config.defaults, renewThresholdMinutes: parseInt(e.target.value) || 30 } })
              }
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ ...labelStyle, marginBottom: theme.spacing.md }}>Global Schedule</div>
        <ScheduleEditor value={config.schedule} onChange={updateSchedule} />
      </div>

      <div style={{ display: 'flex', gap: theme.spacing.sm, alignItems: 'center' }}>
        <button onClick={save} disabled={saving} style={saveBtn(saving)}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saved && <span style={{ color: theme.colors.active, fontSize: theme.fontSize.sm, fontFamily: theme.font.sans }}>Saved ✓</span>}
      </div>
    </div>
  );
}

// ── Global Rules tab ───────────────────────────────────────────────────────

function GlobalRulesTab() {
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // Count of projects whose CLAUDE.md global-rules block is out of sync
  const [outOfSyncCount, setOutOfSyncCount] = useState(0);

  useEffect(() => {
    getGlobalRules().then(setContent).catch(() => {});
    // Count how many projects have out-of-sync global rules
    listProjects().then(async (projects) => {
      const syncFlags = await Promise.all(
        projects.map((p) =>
          getRules(p.id).then((r) => r.globalRulesOutOfSync).catch(() => false)
        )
      );
      setOutOfSyncCount(syncFlags.filter(Boolean).length);
    }).catch(() => {});
  }, []);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setSaved(false);
    try {
      const updated = await putGlobalRules(content);
      setContent(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2_000);
    } finally { setSaving(false); }
  };

  return (
    <div>
      <div style={cardStyle}>
        <div style={{ marginBottom: theme.spacing.sm, display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
          <span style={{ fontFamily: theme.font.sans, fontSize: theme.fontSize.xs, color: theme.colors.muted }}>
            These rules are injected at the top of every project's CLAUDE.md.
          </span>
          {outOfSyncCount > 0 && (
            <span style={{
              background: theme.colors.warning,
              color: theme.colors.bg,
              fontFamily: theme.font.sans,
              fontSize: theme.fontSize.xs,
              fontWeight: theme.fontWeight.semibold,
              padding: '2px 7px',
              borderRadius: '999px',
            }}>
              {outOfSyncCount} out of sync
            </span>
          )}
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          style={{
            width: '100%',
            minHeight: '300px',
            background: theme.colors.bg,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.sm,
            color: theme.colors.text,
            fontFamily: theme.font.mono,
            fontSize: theme.fontSize.sm,
            padding: theme.spacing.md,
            resize: 'vertical',
            boxSizing: 'border-box',
            outline: 'none',
          }}
        />
      </div>
      <div style={{ display: 'flex', gap: theme.spacing.sm, alignItems: 'center' }}>
        <button onClick={save} disabled={saving} style={saveBtn(saving)}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saved && <span style={{ color: theme.colors.active, fontSize: theme.fontSize.sm, fontFamily: theme.font.sans }}>Saved ✓</span>}
      </div>
    </div>
  );
}

// ── Auth tab ───────────────────────────────────────────────────────────────

function AuthTab() {
  const [status, setStatus] = useState<AuthStatusResponse | null>(null);
  const [showStream, setShowStream] = useState(false);
  const [streamLines, setStreamLines] = useState<string[]>([]);
  const [streamDone, setStreamDone] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    getAuthStatus().then(setStatus).catch(() => {});
  }, []);

  const startLogin = async () => {
    try {
      await postLogin();
      setStreamLines([]);
      setStreamDone(false);
      setShowStream(true);
      const ws = new WebSocket(wsUrl('/api/v1/auth/login/stream'));
      wsRef.current = ws;
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data as string) as { line?: string; done?: boolean; success?: boolean };
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
        } catch { /* ignore */ }
      };
      ws.onerror = () => { setStreamDone(true); ws.close(); };
    } catch { /* ignore */ }
  };

  useEffect(() => () => { wsRef.current?.close(); }, []);

  return (
    <div>
      <div style={cardStyle}>
        {status ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
            <span style={{
              fontFamily: theme.font.sans,
              fontSize: theme.fontSize.md,
              color: status.authenticated ? theme.colors.active : theme.colors.danger,
            }}>
              {status.authenticated ? '✅ Authenticated' : '❌ Not authenticated'}
            </span>
            {status.email && (
              <span style={{ fontFamily: theme.font.mono, fontSize: theme.fontSize.sm, color: theme.colors.muted }}>
                {status.email}
              </span>
            )}
          </div>
        ) : (
          <div style={{ color: theme.colors.muted, fontFamily: theme.font.sans, fontSize: theme.fontSize.sm }}>Loading…</div>
        )}
      </div>

      <div style={{ marginBottom: theme.spacing.md }}>
        <button
          onClick={startLogin}
          style={{
            background: 'none',
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.sm,
            color: theme.colors.text,
            cursor: 'pointer',
            fontSize: theme.fontSize.sm,
            fontFamily: theme.font.sans,
            padding: '7px 16px',
          }}
        >
          {status?.authenticated ? 'Re-authenticate' : 'Authenticate'}
        </button>
      </div>

      {showStream && (
        <div style={cardStyle}>
          <div style={{ fontFamily: theme.font.sans, fontSize: theme.fontSize.xs, color: theme.colors.muted, marginBottom: theme.spacing.sm, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Auth stream
            {streamDone && <span style={{ color: theme.colors.active, marginLeft: '8px' }}>Done</span>}
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
            whiteSpace: 'pre-wrap',
          }}>
            {streamLines.map((l, i) => <div key={i}>{l}</div>)}
            {streamLines.length === 0 && <span style={{ color: theme.colors.muted }}>Waiting…</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── SettingsPage ───────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [tab, setTab] = useState<ActiveTab>('defaults');

  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    background: 'none',
    border: 'none',
    borderBottom: active ? `2px solid ${theme.colors.accent}` : '2px solid transparent',
    marginBottom: '-1px',
    padding: '0 12px',
    height: '40px',
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.medium,
    fontFamily: theme.font.sans,
    letterSpacing: '0.06em',
    cursor: 'pointer',
    color: active ? theme.colors.accent : theme.colors.muted,
    transition: 'color 0.15s, border-color 0.15s',
  });

  return (
    <div style={{ maxWidth: theme.maxWidth, margin: '0 auto', padding: `${theme.spacing['2xl']} ${theme.spacing.xl}` }}>
      <h1 style={{
        fontFamily: theme.font.sans,
        fontSize: theme.fontSize.xl,
        fontWeight: theme.fontWeight.semibold,
        color: theme.colors.text,
        marginBottom: theme.spacing.xl,
      }}>
        Settings
      </h1>

      {/* Tab bar */}
      <div style={{
        display: 'flex',
        borderBottom: `1px solid ${theme.colors.border}`,
        marginBottom: theme.spacing.xl,
        height: '40px',
        alignItems: 'flex-end',
      }}>
        <button onClick={() => setTab('defaults')} style={tabBtnStyle(tab === 'defaults')}>DEFAULTS</button>
        <button onClick={() => setTab('rules')}    style={tabBtnStyle(tab === 'rules')}>GLOBAL RULES</button>
        <button onClick={() => setTab('auth')}     style={tabBtnStyle(tab === 'auth')}>AUTH</button>
      </div>

      {tab === 'defaults' && <DefaultsTab />}
      {tab === 'rules'    && <GlobalRulesTab />}
      {tab === 'auth'     && <AuthTab />}
    </div>
  );
}
