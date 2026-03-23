import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { theme } from '../../theme';
import CountdownTimer from '../../components/CountdownTimer';
import { getTelegramModel } from '../../api/settings';
import type { Project, ModelOverride } from '../../api/types';

interface ProjectCardProps {
  project: Project;
}

// ── Status dot ────────────────────────────────────────────────────────────────

function StatusDot({ active }: { active: boolean }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      padding: '2px 8px',
      background: active ? theme.colors.successBg : theme.colors.surfaceElevated,
      border: `1px solid ${active ? theme.colors.success + '40' : theme.colors.border}`,
      borderRadius: theme.radius.sm,
      fontSize: '10px',
      fontFamily: theme.font.mono,
      fontWeight: theme.font.weight.semibold,
      color: active ? theme.colors.success : theme.colors.muted,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.06em',
      flexShrink: 0,
    }}>
      <span style={{
        width: '5px', height: '5px', borderRadius: '50%',
        background: active ? theme.colors.success : theme.colors.muted,
        display: 'inline-block',
        animation: active ? 'pulse 2s infinite' : 'none',
      }} />
      {active ? 'LIVE' : 'IDLE'}
    </span>
  );
}

// ── Model chip ─────────────────────────────────────────────────────────────────

function ModelChip({ label, model, color }: { label: string; model: ModelOverride; color: string }) {
  const shortModel = model.model.split('-').slice(-2).join('-');
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
      <span style={{
        fontSize: '9px',
        fontFamily: theme.font.sans,
        color: theme.colors.muted,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.08em',
        fontWeight: theme.font.weight.semibold,
        flexShrink: 0,
        width: '50px',
      }}>
        {label}
      </span>
      <span style={{
        padding: '1px 7px',
        background: color + '18',
        border: `1px solid ${color}30`,
        borderRadius: theme.radius.sm,
        fontFamily: theme.font.mono,
        fontSize: theme.font.size.xs,
        color: color,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {shortModel}
      </span>
    </div>
  );
}

// ── Project card ──────────────────────────────────────────────────────────────

export default function ProjectCard({ project }: ProjectCardProps) {
  const [hovered, setHovered] = useState(false);
  const [telegramModel, setTelegramModel] = useState<ModelOverride | null>(null);
  const isBridgeActive = project.bridge !== null;
  const href = `/projects/${encodeURIComponent(project.groupId)}`;

  // Fetch telegram model for this project
  useEffect(() => {
    getTelegramModel(project.groupId)
      .then((m) => {
        if (m.provider && m.model) {
          setTelegramModel({ provider: m.provider, model: m.model });
        }
      })
      .catch(() => {});
  }, [project.groupId]);

  const hasAnyModel = telegramModel || project.modelOverride;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: theme.colors.surface,
        border: `1px solid ${hovered
          ? (isBridgeActive ? theme.colors.success + '40' : theme.colors.borderAccent)
          : theme.colors.border}`,
        borderRadius: theme.radius.lg,
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        boxShadow: hovered ? theme.shadow.card : '0 2px 8px rgba(0,0,0,0.25)',
        transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
        transition: theme.transition.base,
        cursor: 'default',
        animation: 'fadeIn 0.25s ease',
        position: 'relative',
      }}
    >
      {/* Active accent bar */}
      {isBridgeActive && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0,
          width: '3px',
          height: '100%',
          borderRadius: `${theme.radius.lg} 0 0 ${theme.radius.lg}`,
          background: `linear-gradient(180deg, ${theme.colors.success}, ${theme.colors.accent})`,
        }} />
      )}

      {/* Header row: name + status */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <Link
          to={href}
          style={{
            fontFamily: theme.font.display,
            fontWeight: theme.font.weight.bold,
            fontSize: theme.font.size.lg,
            color: theme.colors.text,
            textDecoration: 'none',
            lineHeight: 1.2,
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {project.projectId}
        </Link>
        <StatusDot active={isBridgeActive} />
      </div>

      {/* Repo URL */}
      <div style={{
        fontFamily: theme.font.mono,
        fontSize: theme.font.size.xs,
        color: theme.colors.muted,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {project.repoUrl}
      </div>

      {/* Models section */}
      {hasAnyModel && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          padding: '8px 10px',
          background: theme.colors.surfaceElevated,
          borderRadius: theme.radius.md,
          border: `1px solid ${theme.colors.border}`,
        }}>
          {telegramModel && (
            <ModelChip label="Telegram" model={telegramModel} color={theme.colors.purple} />
          )}
          {project.modelOverride && (
            <ModelChip label="Session" model={project.modelOverride} color={theme.colors.accent} />
          )}
        </div>
      )}

      {/* Bridge expiry */}
      {project.bridge && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '5px 10px',
          background: theme.colors.successBg,
          border: `1px solid ${theme.colors.success}22`,
          borderRadius: theme.radius.md,
          fontSize: theme.font.size.xs,
        }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={theme.colors.success} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          <span style={{ color: theme.colors.muted, fontFamily: theme.font.sans }}>Expires</span>
          <CountdownTimer expiresAt={project.bridge.expiresAt} />
          {project.bridge.autoRenew && (
            <span style={{ marginLeft: 'auto', color: theme.colors.success, fontFamily: theme.font.mono, fontSize: '10px' }}>
              auto ↻
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: '2px' }}>
        <Link
          to={href}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '5px 12px',
            background: 'transparent',
            border: `1px solid ${hovered ? theme.colors.borderAccent : theme.colors.border}`,
            borderRadius: theme.radius.md,
            color: hovered ? theme.colors.text : theme.colors.textSecondary,
            fontSize: theme.font.size.sm,
            fontFamily: theme.font.sans,
            fontWeight: theme.font.weight.medium,
            textDecoration: 'none',
            transition: theme.transition.fast,
          }}
        >
          Open →
        </Link>
      </div>
    </div>
  );
}
