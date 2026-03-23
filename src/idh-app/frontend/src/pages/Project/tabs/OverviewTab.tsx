import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { theme } from '../../../theme';
import { getProject } from '../../../api/projects';
import { getContextSize } from '../../../api/settings';
import { startBridge, stopBridge, renewBridge } from '../../../api/bridge';
import ContextSizeMeter from '../../../components/ContextSizeMeter';
import CountdownTimer from '../../../components/CountdownTimer';
import StatusBadge from '../../../components/StatusBadge';
import type { Project, ContextSizeResponse } from '../../../api/types';

interface OverviewTabProps {
  groupId: string;
}

// ── Card component ────────────────────────────────────────────────────────────

function Card({ children }: { children: ReactNode }) {
  return (
    <div style={{
      background: theme.colors.surface,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.radius.md,
      padding: theme.spacing.lg,
      marginBottom: theme.spacing.md,
    }}>
      {children}
    </div>
  );
}

// ── Card title ────────────────────────────────────────────────────────────────

function CardTitle({ children }: { children: ReactNode }) {
  return (
    <div style={{
      fontSize: theme.fontSize.xs,
      fontWeight: theme.fontWeight.medium,
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      marginBottom: theme.spacing.md,
      fontFamily: theme.font.sans,
    }}>
      {children}
    </div>
  );
}

// ── Action button ─────────────────────────────────────────────────────────────

type ActionBtnVariant = 'start' | 'stop' | 'renew';

function ActionButton({
  variant,
  disabled,
  onClick,
}: {
  variant: ActionBtnVariant;
  disabled: boolean;
  onClick: () => void;
}) {
  const styleMap: Record<ActionBtnVariant, React.CSSProperties> = {
    start: {
      background: theme.colors.active,
      color: theme.colors.bg,
      border: 'none',
    },
    stop: {
      background: 'none',
      color: theme.colors.danger,
      border: `1px solid ${theme.colors.danger}55`,
    },
    renew: {
      background: 'none',
      color: theme.colors.text,
      border: `1px solid ${theme.colors.borderStrong}`,
    },
  };

  const labelMap: Record<ActionBtnVariant, string> = {
    start: 'Start',
    stop: 'Stop',
    renew: 'Renew',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...styleMap[variant],
        padding: `${theme.spacing.xs} ${theme.spacing.md}`,
        borderRadius: theme.radius.md,
        fontSize: theme.fontSize.xs,
        fontFamily: theme.font.sans,
        fontWeight: theme.fontWeight.medium,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {labelMap[variant]}
    </button>
  );
}

// ── OverviewTab ───────────────────────────────────────────────────────────────

export default function OverviewTab({ groupId }: OverviewTabProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [contextSize, setContextSize] = useState<ContextSizeResponse | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // 1. Load project and context size on mount
  useEffect(() => {
    if (!groupId) return;
    getProject(groupId)
      .then(setProject)
      .catch(() => setProject(null));
    getContextSize(groupId)
      .then(setContextSize)
      .catch(() => setContextSize(null));
  }, [groupId]);

  // 2. Bridge action helper — calls fn, then refreshes project
  const act = async (fn: () => Promise<unknown>) => {
    if (actionBusy || !project) return;
    setActionBusy(true);
    setActionError(null);
    try {
      await fn();
      const updated = await getProject(groupId);
      setProject(updated);
    } catch (err) {
      setActionError('Action failed. Please try again.');
    } finally {
      setActionBusy(false);
    }
  };

  if (!project) {
    return (
      <div style={{ color: theme.colors.muted, fontSize: theme.fontSize.sm, fontFamily: theme.font.sans }}>
        Loading…
      </div>
    );
  }

  const isActive = project.bridge !== null;
  const modelLabel = project.modelOverride
    ? project.modelOverride.model
    : 'default';

  // Named style for the "Always active" badge — kept manual since StatusBadge
  // shows "SESSION ACTIVE", which is a different label for a different purpose.
  const alwaysActiveBadgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '2px 8px',
    borderRadius: theme.radius.sm,
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.medium,
    fontFamily: theme.font.sans,
    color: theme.colors.active,
    background: theme.colors.active + '1a',
    border: `1px solid ${theme.colors.active}33`,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.lg, alignItems: 'start' }}>

      {/* Left column */}
      <div>
        {/* Session code card */}
        <Card>
          <CardTitle>Session code</CardTitle>
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
            <StatusBadge status={isActive ? 'active' : 'idle'} />
            {isActive && project.bridge && (
              <CountdownTimer expiresAt={project.bridge.expiresAt} />
            )}
          </div>
          <div style={{ display: 'flex', gap: theme.spacing.sm }}>
            {!isActive && (
              <ActionButton
                variant="start"
                disabled={actionBusy}
                onClick={() => act(() => startBridge(groupId))}
              />
            )}
            {isActive && (
              <>
                <ActionButton
                  variant="stop"
                  disabled={actionBusy}
                  onClick={() => act(() => stopBridge(groupId))}
                />
                <ActionButton
                  variant="renew"
                  disabled={actionBusy}
                  onClick={() => act(() => renewBridge(groupId))}
                />
              </>
            )}
          </div>
          {actionError && (
            <span style={{ color: theme.colors.danger, fontSize: theme.fontSize.sm, marginTop: theme.spacing.sm, display: 'block' }}>
              {actionError}
            </span>
          )}
        </Card>

        {/* Session Telegram card */}
        <Card>
          <CardTitle>Session Telegram</CardTitle>
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
            {/* Manual "always active" badge — kept separate from StatusBadge
                because StatusBadge renders "SESSION ACTIVE", not "Always active" */}
            <span style={alwaysActiveBadgeStyle}>
              <span style={{
                width: '5px', height: '5px', borderRadius: '50%',
                background: theme.colors.active, display: 'inline-block', flexShrink: 0,
              }} />
              Always active
            </span>
          </div>
          <div style={{
            fontFamily: theme.font.mono,
            fontSize: theme.fontSize.sm,
            color: theme.colors.textSecondary,
          }}>
            {modelLabel}
          </div>
        </Card>
      </div>

      {/* Right column */}
      <div>
        {/* Context Budget card */}
        <Card>
          <CardTitle>Context budget</CardTitle>
          {contextSize ? (
            <ContextSizeMeter response={contextSize} />
          ) : (
            <div style={{ color: theme.colors.muted, fontSize: theme.fontSize.sm, fontFamily: theme.font.sans }}>
              Loading context data…
            </div>
          )}
        </Card>

        {/* Project card */}
        <Card>
          <CardTitle>Project</CardTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
            {/* Repo URL */}
            <div>
              <div style={{
                fontSize: theme.fontSize.xs,
                color: theme.colors.muted,
                fontFamily: theme.font.sans,
                marginBottom: theme.spacing.xs,
              }}>
                Repository
              </div>
              <a
                href={project.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: theme.fontSize.sm,
                  fontFamily: theme.font.mono,
                  color: theme.colors.textSecondary,
                  textDecoration: 'none',
                  wordBreak: 'break-all',
                }}
              >
                {project.repoUrl}
              </a>
            </div>

            {/* Group ID */}
            <div>
              <div style={{
                fontSize: theme.fontSize.xs,
                color: theme.colors.muted,
                fontFamily: theme.font.sans,
                marginBottom: theme.spacing.xs,
              }}>
                Group ID
              </div>
              <span style={{
                fontSize: theme.fontSize.sm,
                fontFamily: theme.font.mono,
                color: theme.colors.textSecondary,
              }}>
                {project.groupId}
              </span>
            </div>

            {/* Project ID */}
            <div>
              <div style={{
                fontSize: theme.fontSize.xs,
                color: theme.colors.muted,
                fontFamily: theme.font.sans,
                marginBottom: theme.spacing.xs,
              }}>
                Project ID
              </div>
              <span style={{
                fontSize: theme.fontSize.sm,
                fontFamily: theme.font.mono,
                color: theme.colors.textSecondary,
              }}>
                {project.projectId}
              </span>
            </div>
          </div>
        </Card>
      </div>

    </div>
  );
}
