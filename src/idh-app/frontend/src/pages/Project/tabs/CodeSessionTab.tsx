import { useNavigate, useMatch } from 'react-router-dom';
import { theme } from '../../../theme';
import BridgeSubTab from './code-session/BridgeSubTab';
import FilesSubTab from './code-session/FilesSubTab';
import TranscriptSubTab from './code-session/TranscriptSubTab';
import ScheduleSubTab from './code-session/ScheduleSubTab';
import type { Project } from '../../../api/types';

type SubTab = 'bridge' | 'files' | 'transcript' | 'schedule';

const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: 'bridge',     label: 'Bridge' },
  { id: 'files',      label: 'Files' },
  { id: 'transcript', label: 'Transcript' },
  { id: 'schedule',   label: 'Schedule' },
];

interface CodeSessionTabProps {
  project: Project;
  onProjectChange: (updated: Project) => void;
}

export default function CodeSessionTab({ project, onProjectChange }: CodeSessionTabProps) {
  const navigate = useNavigate();
  const baseUrl = `/projects/${encodeURIComponent(project.groupId)}/code-session`;

  // 1. Determine active sub-tab from URL
  const filesMatch      = useMatch(`${baseUrl}/files`);
  const transcriptMatch = useMatch(`${baseUrl}/transcript`);
  const scheduleMatch   = useMatch(`${baseUrl}/schedule`);

  const activeSubTab: SubTab =
    filesMatch      ? 'files' :
    transcriptMatch ? 'transcript' :
    scheduleMatch   ? 'schedule' :
    'bridge';

  const goTo = (id: SubTab) => {
    navigate(id === 'bridge' ? baseUrl : `${baseUrl}/${id}`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.lg }}>
      {/* Secondary sub-tab bar */}
      <div style={{
        display: 'flex',
        gap: '2px',
        borderBottom: `1px solid ${theme.colors.borderSubtle}`,
        paddingBottom: '1px',
        marginBottom: '-1px',
      }}>
        {SUB_TABS.map((st) => (
          <button
            key={st.id}
            onClick={() => goTo(st.id)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: `${theme.spacing.xs} ${theme.spacing.md}`,
              fontSize: theme.font.size.sm,
              fontWeight: activeSubTab === st.id ? theme.font.weight.medium : theme.font.weight.normal,
              color: activeSubTab === st.id ? theme.colors.text : theme.colors.muted,
              borderBottom: activeSubTab === st.id ? `2px solid ${theme.colors.primary}` : '2px solid transparent',
              marginBottom: '-2px',
              transition: theme.transition.fast,
            }}
          >
            {st.label}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      {activeSubTab === 'bridge'     && <BridgeSubTab     project={project} onProjectChange={onProjectChange} />}
      {activeSubTab === 'files'      && <FilesSubTab      project={project} />}
      {activeSubTab === 'transcript' && <TranscriptSubTab project={project} />}
      {activeSubTab === 'schedule'   && <ScheduleSubTab   project={project} />}
    </div>
  );
}
