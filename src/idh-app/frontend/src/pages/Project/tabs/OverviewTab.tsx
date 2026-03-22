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

function SectionCard({ children, accentColor }: { children: ReactNode; accentColor?: string }) {
  return (
    <div style={{
      background: theme.colors.surface,
      border: `1px solid ${accentColor ? accentColor + '44' : theme.colors.border}`,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.lg,
    }}>
      {children}
    </div>
  );
}

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

  const btnStyle = (variant: 'primary' | 'danger' | 'secondary') => ({
    display: 'inline-flex' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.xs,
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    border: variant === 'secondary' ? `1px solid ${theme.colors.border}` : 'none',
    borderRadius: theme.radius.md,
    cursor: actionLoading ? ('not-allowed' as const) : ('pointer' as const),
    fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.medium,
    background:
      variant === 'primary' ? theme.colors.primary :
      variant === 'danger'  ? theme.colors.danger :
      theme.colors.surfaceElevated,
    color: variant === 'secondary' ? theme.colors.text : theme.colors.onPrimary,
    opacity: actionLoading ? 0.6 : 1,
    transition: theme.transition.fast,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.lg }}>
      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.lg, alignItems: 'start' }}>

        {/* Left: Project identity card */}
        <SectionCard>
          <div style={{ fontSize: theme.font.size.xxxl, fontWeight: theme.font.weight.bold, color: theme.colors.text, marginBottom: theme.spacing.xs }}>
            {project.projectId}
          </div>
          <a
            href={project.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={project.repoUrl}
            style={{
              display: 'block',
              fontSize: theme.font.size.sm,
              fontFamily: theme.font.mono,
              color: theme.colors.link,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginBottom: theme.spacing.sm,
            }}
          >
            {project.repoUrl}
          </a>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: `2px ${theme.spacing.sm}`,
            background: theme.colors.surfaceElevated,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.sm,
            fontFamily: theme.font.mono,
            fontSize: theme.font.size.xs,
            color: theme.colors.muted,
          }}>
            {project.groupId}
          </div>
        </SectionCard>

        {/* Right: Two stacked status cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
          {/* Telegram agent card */}
          <SectionCard accentColor={theme.colors.accent}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.sm }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: theme.colors.accent, display: 'inline-block' }} />
                <span style={{ fontSize: theme.font.size.sm, fontWeight: theme.font.weight.semibold, color: theme.colors.text }}>Telegram Agent</span>
              </div>
              <span style={{
                padding: `2px ${theme.spacing.sm}`,
                background: `${theme.colors.accent}22`,
                border: `1px solid ${theme.colors.accent}44`,
                borderRadius: theme.radius.full,
                fontSize: theme.font.size.xs,
                color: theme.colors.accent,
              }}>
                {modelLabel}
              </span>
            </div>
            <div style={{ fontSize: theme.font.size.xs, color: theme.colors.muted, fontFamily: theme.font.mono }}>
              Group {project.groupId}
            </div>
          </SectionCard>

          {/* Code session card */}
          <SectionCard accentColor={isActive ? theme.colors.primary : undefined}>
            <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.sm }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isActive ? theme.colors.success : theme.colors.muted, display: 'inline-block' }} />
              <span style={{ fontSize: theme.font.size.sm, fontWeight: theme.font.weight.semibold, color: theme.colors.text }}>
                Code Session
              </span>
              {/* Status badge — "Active" when bridge is running, "Idle" otherwise */}
              <span style={{
                padding: `2px ${theme.spacing.sm}`,
                background: isActive ? `${theme.colors.success}22` : theme.colors.surfaceElevated,
                border: `1px solid ${isActive ? theme.colors.success + '44' : theme.colors.border}`,
                borderRadius: theme.radius.full,
                fontSize: theme.font.size.xs,
                color: isActive ? theme.colors.success : theme.colors.muted,
              }}>
                {isActive ? 'Active' : 'Idle'}
              </span>
              {isActive && (
                <span style={{ fontFamily: theme.font.mono, fontSize: theme.font.size.xs, color: theme.colors.muted }}>
                  PID {project.bridge!.pid}
                </span>
              )}
            </div>
            {isActive && project.bridge && (
              <>
                <div style={{ fontSize: theme.font.size.xs, color: theme.colors.muted, fontFamily: theme.font.mono, marginBottom: theme.spacing.xs, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={project.bridge.workspace}>
                  {project.bridge.workspace}
                </div>
                <div style={{ fontSize: theme.font.size.md, fontFamily: theme.font.mono, color: theme.colors.warning, fontWeight: theme.font.weight.semibold }}>
                  <CountdownTimer expiresAt={project.bridge.expiresAt} />
                </div>
              </>
            )}
            {!isActive && (
              <div style={{ fontSize: theme.font.size.xs, color: theme.colors.muted }}>No bridge running</div>
            )}
          </SectionCard>
        </div>
      </div>

      {/* Quick actions strip */}
      <div style={{ display: 'flex', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
        {!isActive && (
          <button style={btnStyle('primary')} disabled={actionLoading !== null}
            onClick={() => act('start', () => startBridge(project.groupId))}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            {actionLoading === 'start' ? 'Starting…' : 'Start Bridge'}
          </button>
        )}
        {isActive && (
          <>
            <button style={btnStyle('secondary')} disabled={actionLoading !== null}
              onClick={() => act('renew', () => renewBridge(project.groupId))}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
              {actionLoading === 'renew' ? 'Renewing…' : 'Renew'}
            </button>
            <button style={btnStyle('danger')} disabled={actionLoading !== null}
              onClick={() => act('stop', () => stopBridge(project.groupId))}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
              {actionLoading === 'stop' ? 'Stopping…' : 'Stop Bridge'}
            </button>
          </>
        )}
      </div>

      {/* Inline error */}
      {actionError && (
        <div style={{
          padding: `${theme.spacing.sm} ${theme.spacing.md}`,
          background: theme.colors.dangerBg,
          border: `1px solid ${theme.colors.danger}44`,
          borderRadius: theme.radius.sm,
          color: theme.colors.danger,
          fontSize: theme.font.size.sm,
        }}>
          {actionError}
        </div>
      )}

      {/* Context size meter */}
      {contextSize && (
        <div style={{
          background: theme.colors.surface,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.radius.lg,
          padding: theme.spacing.lg,
        }}>
          <ContextSizeMeter response={contextSize} />
        </div>
      )}
    </div>
  );
}
