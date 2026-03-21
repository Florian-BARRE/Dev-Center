import { theme } from '../../../theme';
import type { Project } from '../../../api/types';

interface OverviewTabProps {
  project: Project;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: theme.spacing.md, padding: `${theme.spacing.sm} 0`, borderBottom: `1px solid ${theme.colors.border}` }}>
      <span style={{ color: theme.colors.muted, fontSize: theme.font.size.sm }}>{label}</span>
      <span style={{ fontFamily: theme.font.mono, fontSize: theme.font.size.sm, wordBreak: 'break-all' }}>{value}</span>
    </div>
  );
}

export default function OverviewTab({ project }: OverviewTabProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <Row label="Group ID" value={project.groupId} />
      <Row label="Repository" value={project.repoUrl} />
      <Row label="Model" value={
        project.modelOverride
          ? `${project.modelOverride.provider} / ${project.modelOverride.model}`
          : '(default)'
      } />
      <Row label="Bridge" value={project.bridge ? `PID ${project.bridge.pid}` : 'Idle'} />
      {project.bridge && (
        <Row label="Workspace" value={project.bridge.workspace} />
      )}
    </div>
  );
}
