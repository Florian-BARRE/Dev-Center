import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { theme } from '../../../theme';
import { getContextSize } from '../../../api/settings';
import { startBridge, stopBridge, renewBridge } from '../../../api/bridge';
import { getProject } from '../../../api/projects';
import ContextSizeMeter from '../../../components/ContextSizeMeter';
import CountdownTimer from '../../../components/CountdownTimer';
import type { Project } from '../../../api/types';
import type { ContextSizeResponse } from '../../../api/types';

interface OverviewTabProps {
  project: Project;
  onProjectChange: (updated: Project) => void;
}

// ── Info card ─────────────────────────────────────────────────────────────────

function InfoCard({ title, accent, children }: { title: string; accent?: string; children: ReactNode }) {
  return (
    <div style={{
      background: theme.colors.surface,
      border: `1px solid ${accent ? accent + '33' : theme.colors.border}`,
      borderRadius: theme.radius.lg,
      padding: '16px',
      boxShadow: theme.shadow.card,
    }}>
      <div style={{
        fontSize: '10px',
        fontFamily: theme.font.sans,
        fontWeight: theme.font.weight.semibold,
        color: theme.colors.muted,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        marginBottom: '10px',
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

// ── Action button ─────────────────────────────────────────────────────────────

type BtnVariant = 'primary' | 'danger' | 'secondary';

function ActionBtn({
  variant, disabled, onClick, children
}: { variant: BtnVariant; disabled: boolean; onClick: () => void; children: ReactNode }) {
  const bg =
    variant === 'primary' ? theme.colors.accent :
    variant === 'danger'  ? theme.colors.danger :
    theme.colors.surfaceElevated;
  const color =
    variant === 'secondary' ? theme.colors.text : theme.colors.onPrimary;
  const border =
    variant === 'secondary' ? `1px solid ${theme.colors.borderAccent}` : 'none';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '7px 14px',
        background: bg,
        color: color,
        border: border,
        borderRadius: theme.radius.md,
        fontSize: theme.font.size.sm,
        fontFamily: theme.font.sans,
        fontWeight: theme.font.weight.medium,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: theme.transition.fast,
      }}
    >
      {children}
    </button>
  );
}

// ── OverviewTab ───────────────────────────────────────────────────────────────

export default function OverviewTab({ project, onProjectChange }: OverviewTabProps) {
  const [contextSize, setContextSize] = useState<ContextSizeResponse | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const isActive = project.bridge !== null;

  // 1. Load context size on mount
  useEffect(() => {
    getContextSize(project.groupId)
      .then(setContextSize)
      .catch(() => setContextSize(null));
  }, [project.groupId]);

  // 2. Bridge action helper — calls fn, then refreshes project
  const act = async (label: string, fn: () => Promise<unknown>) => {
    setActionLoading(label);
    setActionError(null);
    try {
      await fn();
      const updated = await getProject(project.groupId);
      onProjectChange(updated);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const modelLabel = project.modelOverride
    ? `${project.modelOverride.model}`
    : 'default';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Project identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{
          fontFamily: theme.font.display,
          fontWeight: theme.font.weight.bold,
          fontSize: theme.font.size.lg,
          color: theme.colors.text,
        }}>
          {project.projectId}
        </span>
        <a
          href={project.repoUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontFamily: theme.font.mono,
            fontSize: theme.font.size.xs,
            color: theme.colors.muted,
            textDecoration: 'none',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {project.repoUrl}
        </a>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>

        {/* Left col: project identity + context meter */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Context size meter */}
          {contextSize && (
            <InfoCard title="Context Budget">
              <ContextSizeMeter response={contextSize} />
            </InfoCard>
          )}

          {/* Bridge info */}
          <InfoCard title="Bridge" accent={isActive ? theme.colors.success : undefined}>
            {isActive && project.bridge ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: theme.colors.success, display: 'inline-block',
                    animation: 'pulse 2s infinite',
                  }} />
                  <span style={{ fontSize: theme.font.size.sm, color: theme.colors.text, fontWeight: theme.font.weight.medium }}>Active</span>
                  <span style={{ fontFamily: theme.font.mono, fontSize: theme.font.size.xs, color: theme.colors.muted, marginLeft: 'auto' }}>
                    PID {project.bridge.pid}
                  </span>
                </div>
                <div style={{ fontFamily: theme.font.mono, fontSize: theme.font.size.xl, color: theme.colors.warning, fontWeight: theme.font.weight.semibold }}>
                  <CountdownTimer expiresAt={project.bridge.expiresAt} />
                </div>
                <div style={{
                  fontSize: theme.font.size.xs,
                  fontFamily: theme.font.mono,
                  color: theme.colors.muted,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }} title={project.bridge.workspace}>
                  {project.bridge.workspace}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: theme.font.size.sm, color: theme.colors.muted }}>No bridge running</div>
            )}
          </InfoCard>

          {/* Schedule info */}
          {project.schedule && (
            <InfoCard title="Schedule">
              <div style={{ fontSize: theme.font.size.xs, color: theme.colors.muted }}>
                {project.schedule.enabled
                  ? `${project.schedule.renewalTimes.length} renewal time${project.schedule.renewalTimes.length !== 1 ? 's' : ''} configured`
                  : 'Schedule disabled'}
              </div>
            </InfoCard>
          )}
        </div>

        {/* Right col: model + quick actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Model info */}
          <InfoCard title="AI Model" accent={theme.colors.purple}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: theme.colors.purple, display: 'inline-block',
              }} />
              <span style={{ fontSize: theme.font.size.sm, color: theme.colors.text, fontWeight: theme.font.weight.medium }}>
                Telegram Agent
              </span>
            </div>
            <div style={{
              marginTop: '8px',
              padding: '4px 10px',
              display: 'inline-block',
              background: theme.colors.purpleDim,
              border: `1px solid ${theme.colors.purple}33`,
              borderRadius: theme.radius.sm,
              fontFamily: theme.font.mono,
              fontSize: theme.font.size.xs,
              color: theme.colors.purple,
            }}>
              {modelLabel}
            </div>
            <div style={{ marginTop: '8px', fontSize: theme.font.size.xs, fontFamily: theme.font.mono, color: theme.colors.muted }}>
              Group {project.groupId}
            </div>
          </InfoCard>

          {/* Quick actions */}
          <InfoCard title="Quick Actions">
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {!isActive && (
                <ActionBtn
                  variant="primary"
                  disabled={actionLoading !== null}
                  onClick={() => act('start', () => startBridge(project.groupId))}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  {actionLoading === 'start' ? 'Starting…' : 'Start Bridge'}
                </ActionBtn>
              )}
              {isActive && (
                <>
                  <ActionBtn
                    variant="secondary"
                    disabled={actionLoading !== null}
                    onClick={() => act('renew', () => renewBridge(project.groupId))}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                    {actionLoading === 'renew' ? 'Renewing…' : 'Renew'}
                  </ActionBtn>
                  <ActionBtn
                    variant="danger"
                    disabled={actionLoading !== null}
                    onClick={() => act('stop', () => stopBridge(project.groupId))}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
                    {actionLoading === 'stop' ? 'Stopping…' : 'Stop Bridge'}
                  </ActionBtn>
                </>
              )}
            </div>
          </InfoCard>
        </div>
      </div>

      {/* Action error */}
      {actionError && (
        <div style={{
          padding: '8px 12px',
          background: theme.colors.dangerBg,
          border: `1px solid ${theme.colors.danger}44`,
          borderRadius: theme.radius.sm,
          color: theme.colors.danger,
          fontSize: theme.font.size.sm,
        }}>
          {actionError}
        </div>
      )}
    </div>
  );
}
