import { useEffect, useState } from 'react';
import { theme } from '../../theme';
import { getGlobalCodingRules, getGlobalCommonContext } from '../../api/settings';
import CodingRulesEditor from './CodingRulesEditor';
import CommonContextEditor from './CommonContextEditor';
import DefaultsEditor from './DefaultsEditor';
import SchedulingEditor from './SchedulingEditor';

type Tab = 'coding-rules' | 'common-context' | 'defaults' | 'scheduling';

const TABS: { id: Tab; label: string; description: string }[] = [
  { id: 'coding-rules',   label: 'Coding Rules',   description: 'Edit the global CODING_RULES.md file' },
  { id: 'common-context', label: 'Common Context', description: 'Global context injected into every agent prompt' },
  { id: 'defaults',       label: 'Defaults',       description: 'Default values applied to every new project at creation' },
  { id: 'scheduling',     label: 'Scheduling',     description: 'Global session schedule — projects inherit this unless overridden' },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('coding-rules');
  const [codingRules, setCodingRules] = useState<string | null>(null);
  const [commonContext, setCommonContext] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getGlobalCodingRules(), getGlobalCommonContext()])
      .then(([rules, ctx]) => {
        setCodingRules(rules.content);
        setCommonContext(ctx.content);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <div style={{ padding: theme.spacing.xl }}>
      {/* Page header */}
      <div style={{ marginBottom: theme.spacing.xl }}>
        <h1 style={{ margin: 0, fontSize: theme.font.size.xxxl, fontWeight: theme.font.weight.bold, color: theme.colors.text, lineHeight: 1.1 }}>
          Settings
        </h1>
        <p style={{ margin: `${theme.spacing.xs} 0 0`, fontSize: theme.font.size.sm, color: theme.colors.muted }}>
          Global configuration applied to all projects
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '2px', borderBottom: `1px solid ${theme.colors.border}`, marginBottom: theme.spacing.xl }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              background: 'none', border: 'none',
              color: tab === t.id ? theme.colors.text : theme.colors.muted,
              fontSize: theme.font.size.sm,
              fontWeight: tab === t.id ? theme.font.weight.semibold : theme.font.weight.normal,
              cursor: 'pointer',
              padding: `${theme.spacing.sm} ${theme.spacing.md}`,
              borderBottom: tab === t.id ? `2px solid ${theme.colors.primary}` : '2px solid transparent',
              marginBottom: '-1px', transition: theme.transition.fast,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab description */}
      <p style={{ margin: `0 0 ${theme.spacing.lg}`, fontSize: theme.font.size.sm, color: theme.colors.muted }}>
        {TABS.find((t) => t.id === tab)?.description}
      </p>

      {error && (
        <div style={{ padding: `${theme.spacing.sm} ${theme.spacing.md}`, background: theme.colors.dangerBg, border: `1px solid ${theme.colors.danger}44`, borderRadius: theme.radius.sm, color: theme.colors.danger, fontSize: theme.font.size.sm, marginBottom: theme.spacing.lg }}>
          {error}
        </div>
      )}

      {tab === 'coding-rules'   && codingRules !== null && <CodingRulesEditor initialContent={codingRules} />}
      {tab === 'coding-rules'   && codingRules === null && !error && (
        <div style={{ color: theme.colors.muted, fontSize: theme.font.size.sm }}>Loading…</div>
      )}
      {tab === 'common-context' && commonContext !== null && <CommonContextEditor initialContent={commonContext} />}
      {tab === 'common-context' && commonContext === null && !error && (
        <div style={{ color: theme.colors.muted, fontSize: theme.font.size.sm }}>Loading…</div>
      )}
      {tab === 'defaults'   && <DefaultsEditor />}
      {tab === 'scheduling' && <SchedulingEditor />}
    </div>
  );
}
