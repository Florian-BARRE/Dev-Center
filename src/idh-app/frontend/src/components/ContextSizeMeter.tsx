import { theme } from '../theme';
import type { ContextSizeResponse } from '../api/types';

interface ContextSizeMeterProps {
  response: ContextSizeResponse;
}

function formatTokens(n: number): string {
  // Use en-US locale explicitly so output is deterministic across all environments.
  return n.toLocaleString('en-US');
}

export default function ContextSizeMeter({ response }: ContextSizeMeterProps) {
  const pct = Math.round((response.total / response.estimatedMax) * 100);

  // 1. Pick fill color based on percentage
  const fillColor =
    pct > 80 ? theme.colors.danger :
    pct > 50 ? theme.colors.warning :
    theme.colors.success;

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
          fontSize: '10px',
          fontFamily: theme.font.sans,
          color: theme.colors.muted,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          fontWeight: theme.font.weight.semibold,
        }}>
          Context budget
        </span>
        <span style={{ fontSize: theme.font.size.xs, fontFamily: theme.font.mono, color: theme.colors.text }}>
          {formatTokens(response.total)} / ~{formatTokens(response.estimatedMax)} tokens
        </span>
      </div>

      {/* Progress bar */}
      <div style={{
        height: '5px',
        background: theme.colors.surfaceElevated,
        borderRadius: theme.radius.full,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${Math.min(pct, 100)}%`,
          background: fillColor,
          borderRadius: theme.radius.full,
          transition: 'width 0.3s ease',
          boxShadow: `0 0 6px ${fillColor}66`,
        }} />
      </div>

      {/* Percentage + breakdown */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: theme.font.size.xs, fontFamily: theme.font.mono, color: fillColor, fontWeight: theme.font.weight.semibold }}>
          {pct}%
        </span>
        {breakdown.map((b) => (
          <span key={b.label} style={{ fontSize: theme.font.size.xs, color: theme.colors.muted }}>
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
