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
    <div style={{
      padding: '32px',
      animation: 'fadeIn 0.3s ease',
    }}>
      {/* Page header */}
      <div style={{
        paddingBottom: '24px',
        borderBottom: `1px solid ${theme.colors.border}`,
        marginBottom: '24px',
      }}>
        <h1 style={{
          margin: 0,
          fontFamily: theme.font.display,
          fontWeight: theme.font.weight.bold,
          fontSize: theme.font.size.xl,
          color: theme.colors.text,
          lineHeight: 1.1,
        }}>
          Global Settings
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: theme.font.size.sm, color: theme.colors.muted }}>
          Global configuration applied to all projects
        </p>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex',
        gap: '2px',
        borderBottom: `1px solid ${theme.colors.border}`,
        marginBottom: '24px',
      }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              background: 'none',
              border: 'none',
              color: tab === t.id ? theme.colors.accent : theme.colors.muted,
              fontSize: theme.font.size.md,
              fontFamily: theme.font.sans,
              fontWeight: tab === t.id ? theme.font.weight.semibold : theme.font.weight.normal,
              cursor: 'pointer',
              padding: '8px 16px',
              borderBottom: tab === t.id ? `2px solid ${theme.colors.accent}` : '2px solid transparent',
              marginBottom: '-1px',
              transition: theme.transition.fast,
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

      {/* Error */}
      {error && (
        <div style={{
          padding: '8px 12px',
          background: theme.colors.dangerBg,
          border: `1px solid ${theme.colors.danger}44`,
          borderRadius: theme.radius.sm,
          color: theme.colors.danger,
          fontSize: theme.font.size.sm,
          marginBottom: '16px',
        }}>
          {error}
        </div>
      )}

      {/* Tab content */}
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
