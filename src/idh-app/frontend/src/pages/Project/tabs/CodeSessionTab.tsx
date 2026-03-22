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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Secondary sub-tab bar — pill style */}
      <div style={{
        display: 'flex',
        gap: '4px',
        padding: '4px',
        background: theme.colors.surfaceElevated,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.radius.lg,
        alignSelf: 'flex-start',
      }}>
        {SUB_TABS.map((st) => (
          <button
            key={st.id}
            onClick={() => goTo(st.id)}
            style={{
              background: activeSubTab === st.id ? theme.colors.accentDim : 'none',
              border: activeSubTab === st.id ? `1px solid ${theme.colors.accent}33` : '1px solid transparent',
              borderRadius: theme.radius.md,
              cursor: 'pointer',
              padding: '5px 14px',
              fontSize: theme.font.size.sm,
              fontFamily: theme.font.sans,
              fontWeight: activeSubTab === st.id ? theme.font.weight.semibold : theme.font.weight.normal,
              color: activeSubTab === st.id ? theme.colors.accent : theme.colors.muted,
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
