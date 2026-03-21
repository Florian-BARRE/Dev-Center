import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { theme } from '../../theme';
import { getGlobalCodingRules, getGlobalCommonContext } from '../../api/settings';
import CodingRulesEditor from './CodingRulesEditor';
import CommonContextEditor from './CommonContextEditor';

type Tab = 'coding-rules' | 'common-context';

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
    <div style={{ minHeight: '100vh', background: theme.colors.bg, color: theme.colors.text, fontFamily: theme.font.sans, padding: theme.spacing.xl }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ marginBottom: theme.spacing.lg }}>
          <Link to="/" style={{ color: theme.colors.muted, fontSize: theme.font.size.sm, textDecoration: 'none' }}>← Dashboard</Link>
          <h1 style={{ margin: `${theme.spacing.sm} 0 0`, fontSize: theme.font.size.xxl, fontFamily: theme.font.mono }}>
            Global Settings
          </h1>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: theme.spacing.xs, marginBottom: theme.spacing.lg, borderBottom: `1px solid ${theme.colors.border}`, paddingBottom: theme.spacing.sm }}>
          {(['coding-rules', 'common-context'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                background: 'none',
                border: 'none',
                color: tab === t ? theme.colors.text : theme.colors.muted,
                fontFamily: theme.font.mono,
                fontSize: theme.font.size.md,
                cursor: 'pointer',
                padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                borderBottom: tab === t ? `2px solid ${theme.colors.primary}` : '2px solid transparent',
              }}
            >
              {t === 'coding-rules' ? 'Coding Rules' : 'Common Context'}
            </button>
          ))}
        </div>

        {error && <div style={{ color: theme.colors.danger }}>{error}</div>}
        {!codingRules && !commonContext && !error && <div style={{ color: theme.colors.muted }}>Loading...</div>}
        {tab === 'coding-rules' && codingRules !== null && <CodingRulesEditor initialContent={codingRules} />}
        {tab === 'common-context' && commonContext !== null && <CommonContextEditor initialContent={commonContext} />}
      </div>
    </div>
  );
}
