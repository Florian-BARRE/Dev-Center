import { theme } from '../theme';
import type { ContextSizeResponse } from '../api/types';

interface ContextSizeMeterProps {
  response: ContextSizeResponse;
}

function formatTokens(n: number): string {
  // Use en-US locale explicitly so output is deterministic across all environments.
  return n.toLocaleString('en-US');
}

function fillColor(pct: number): string {
  if (pct > 80) return theme.colors.danger;
  if (pct >= 60) return theme.colors.warning;
  return theme.colors.active;
}

export default function ContextSizeMeter({ response }: ContextSizeMeterProps) {
  const pct = Math.round((response.total / response.estimatedMax) * 100);
  const color = fillColor(pct);

  const breakdown = [
    { label: 'CLAUDE.md',      tokens: response.claudeMd },
    { label: 'System Prompt',  tokens: response.systemPrompt },
    { label: 'SESSION_MEMORY', tokens: response.sessionMemory },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{
          fontSize: theme.fontSize.sm,
          fontFamily: theme.font.sans,
          color: theme.colors.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          fontWeight: theme.fontWeight.medium,
        }}>
          Context budget
        </span>
        <span style={{ fontSize: theme.fontSize.sm, fontFamily: theme.font.mono, color: theme.colors.textSecondary }}>
          {formatTokens(response.total)} / ~{formatTokens(response.estimatedMax)} tokens
        </span>
      </div>

      {/* Progress bar */}
      <div style={{
        height: '5px',
        background: theme.colors.border,
        borderRadius: theme.radius.full,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${Math.min(pct, 100)}%`,
          background: color,
          borderRadius: theme.radius.full,
          transition: 'width 0.3s ease',
        }} />
      </div>

      {/* Percentage + breakdown */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <span style={{
          fontSize: theme.fontSize.md,
          fontFamily: theme.font.mono,
          color: color,
          fontWeight: theme.fontWeight.semibold,
        }}>
          {pct}%
        </span>
        {breakdown.map((b) => (
          <span key={b.label} style={{ fontSize: theme.fontSize.sm, fontFamily: theme.font.sans, color: theme.colors.textSecondary }}>
            {b.label}{' '}
            <span style={{ color: theme.colors.textSecondary, fontFamily: theme.font.mono }}>
              {formatTokens(b.tokens)}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
