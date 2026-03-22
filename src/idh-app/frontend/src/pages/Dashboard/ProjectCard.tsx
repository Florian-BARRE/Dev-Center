import { useState } from 'react';
import { Link } from 'react-router-dom';
import { theme } from '../../theme';
import CountdownTimer from '../../components/CountdownTimer';
import type { Project } from '../../api/types';

interface ProjectCardProps {
  project: Project;
}

// ── Status badge ──────────────────────────────────────────────────────────────

function LiveBadge() {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      padding: '2px 8px',
      background: theme.colors.successBg,
      border: `1px solid ${theme.colors.success}40`,
      borderRadius: theme.radius.sm,
      fontSize: '10px',
      fontFamily: theme.font.mono,
      fontWeight: theme.font.weight.semibold,
      color: theme.colors.success,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.06em',
    }}>
      <span style={{
        width: '6px', height: '6px', borderRadius: '50%',
        background: theme.colors.success, display: 'inline-block',
        animation: 'pulse 2s infinite',
      }} />
      LIVE
    </span>
  );
}

function IdleBadge() {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      padding: '2px 8px',
      background: theme.colors.surfaceElevated,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.radius.sm,
      fontSize: '10px',
      fontFamily: theme.font.mono,
      fontWeight: theme.font.weight.semibold,
      color: theme.colors.muted,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.06em',
    }}>
      <span style={{
        width: '6px', height: '6px', borderRadius: '50%',
        background: theme.colors.muted, display: 'inline-block',
      }} />
      IDLE
    </span>
  );
}

// ── Project card ──────────────────────────────────────────────────────────────

export default function ProjectCard({ project }: ProjectCardProps) {
  const [hovered, setHovered] = useState(false);
  const isBridgeActive = project.bridge !== null;
  const href = `/projects/${encodeURIComponent(project.groupId)}`;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: theme.colors.surface,
        border: `1px solid ${hovered ? theme.colors.borderAccent : theme.colors.border}`,
        borderRadius: theme.radius.lg,
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        boxShadow: hovered ? theme.shadow.card : '0 2px 12px rgba(0,0,0,0.3)',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        transition: theme.transition.base,
        cursor: 'default',
        animation: 'fadeIn 0.3s ease',
      }}
    >
      {/* Top row: name + status */}
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
        {isBridgeActive ? <LiveBadge /> : <IdleBadge />}
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

      {/* Model chip */}
      {project.modelOverride && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            padding: '2px 8px',
            background: theme.colors.purpleDim,
            border: `1px solid ${theme.colors.purple}33`,
            borderRadius: theme.radius.sm,
            fontFamily: theme.font.mono,
            fontSize: theme.font.size.xs,
            color: theme.colors.purple,
          }}>
            {project.modelOverride.provider} / {project.modelOverride.model}
          </span>
        </div>
      )}

      {/* Bridge info */}
      {project.bridge && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 10px',
          background: theme.colors.successBg,
          border: `1px solid ${theme.colors.success}22`,
          borderRadius: theme.radius.md,
          fontSize: theme.font.size.xs,
        }}>
          <span style={{ color: theme.colors.muted, fontFamily: theme.font.sans }}>Expires:</span>
          <CountdownTimer expiresAt={project.bridge.expiresAt} />
          {project.bridge.autoRenew && (
            <span style={{ marginLeft: 'auto', color: theme.colors.success, fontFamily: theme.font.mono }}>auto-renew</span>
          )}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
        <Link
          to={href}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 12px',
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
        {isBridgeActive && (
          <Link
            to={`${href}/code-session`}
            style={{
              fontSize: theme.font.size.xs,
              fontFamily: theme.font.mono,
              color: theme.colors.accent,
              textDecoration: 'none',
              opacity: 0.8,
            }}
          >
            code-session ›
          </Link>
        )}
      </div>
    </div>
  );
}
