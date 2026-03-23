// ====== Code Summary ======
// ProjectCard — single project card rendered in the Dashboard home page grid.

import React from 'react';
import { Link } from 'react-router-dom';
import theme from '../../theme';
import CountdownTimer from '../../components/CountdownTimer';
import type { Project, ModelOverride, TelegramModelResponse } from '../../api/types';

interface Props {
  project: Project;
  telegramModel?: TelegramModelResponse;
}

/**
 * Card summarising a single project: name, status, repo URL, models, and
 * an optional countdown to bridge expiry when a session is active.
 */
export function ProjectCard({ project, telegramModel }: Props) {
  const isActive = project.bridge !== null;
  const statusColor = isActive ? theme.colors.active : theme.colors.muted;

  return (
    <div style={{
      background: theme.colors.surface,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.radius.md,
      padding: theme.spacing.lg,
      marginBottom: theme.spacing.sm,
    }}>
      {/* Header row: status indicator + project name + active/idle badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.sm }}>
        <span style={{ color: statusColor, fontSize: '8px' }}>
          {isActive ? '●' : '○'}
        </span>
        <span style={{
          fontFamily: theme.font.sans,
          fontWeight: theme.fontWeight.semibold,
          fontSize: theme.fontSize.md,
          color: theme.colors.text,
          flex: 1,
        }}>
          {project.projectId}
        </span>
        <span style={{
          fontFamily: theme.font.sans,
          fontSize: theme.fontSize.xs,
          fontWeight: theme.fontWeight.medium,
          color: isActive ? theme.colors.active : theme.colors.muted,
          background: isActive ? theme.colors.activeGlow : 'transparent',
          border: `1px solid ${isActive ? theme.colors.active + '33' : theme.colors.border}`,
          borderRadius: theme.radius.sm,
          padding: '2px 8px',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          {isActive ? 'Session active' : 'Idle'}
        </span>
      </div>

      {/* Repo URL — strip https:// for brevity */}
      <div style={{
        fontFamily: theme.font.mono,
        fontSize: theme.fontSize.xs,
        color: theme.colors.muted,
        marginBottom: theme.spacing.md,
      }}>
        {/* Strip https:// scheme for display; SSH URLs (git@) are shown as-is */}
        {project.repoUrl.replace('https://', '')}
      </div>

      {/* Model rows: telegram model + code session model override */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs, marginBottom: theme.spacing.md }}>
        <ModelRow label="Telegram" model={telegramModel ?? null} />
        <ModelRow label="Code" model={project.modelOverride} />
      </div>

      {/* Footer: optional countdown + arrow link to project detail */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: theme.font.sans, fontSize: theme.fontSize.xs, color: theme.colors.muted }}>
          {isActive && project.bridge && (
            <>Session expires in <CountdownTimer expiresAt={project.bridge.expiresAt} /></>
          )}
        </div>
        <Link
          to={`/projects/${encodeURIComponent(project.groupId)}`}
          style={{ color: theme.colors.textSecondary, textDecoration: 'none', fontSize: theme.fontSize.md }}
        >
          →
        </Link>
      </div>
    </div>
  );
}

// ── ModelRow ──────────────────────────────────────────────────────────────────

interface ModelRowProps {
  label: string;
  model: Pick<ModelOverride, 'provider' | 'model'> | null | undefined;
}

/**
 * A single label + model string row displayed inside a ProjectCard.
 */
function ModelRow({ label, model }: ModelRowProps) {
  return (
    <div style={{ display: 'flex', gap: theme.spacing.md, alignItems: 'center' }}>
      <span style={{
        fontFamily: theme.font.sans,
        fontSize: theme.fontSize.xs,
        color: theme.colors.muted,
        width: '56px',
      }}>
        {label}
      </span>
      <span style={{
        fontFamily: theme.font.mono,
        fontSize: theme.fontSize.xs,
        color: model ? theme.colors.textSecondary : theme.colors.muted,
      }}>
        {model ? `${model.provider} · ${model.model}` : '—'}
      </span>
    </div>
  );
}

export default ProjectCard;
