import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import BridgeSubTab from './BridgeSubTab';
import FilesSubTab from './FilesSubTab';
import TranscriptSubTab from './TranscriptSubTab';
import ScheduleSubTab from './ScheduleSubTab';
import * as bridgeApi from '../../../../api/bridge';
import * as projectsApi from '../../../../api/projects';
import * as settingsApi from '../../../../api/settings';
import * as memoryApi from '../../../../api/memory';
import type { Project } from '../../../../api/types';

vi.mock('../../../../api/bridge');
vi.mock('../../../../api/projects');
vi.mock('../../../../api/settings');
vi.mock('../../../../api/memory');

const mockWs = { onmessage: null, close: vi.fn() };

const project: Project = {
  groupId: '-100g',
  projectId: 'Patrimonium',
  repoUrl: 'https://github.com/test/repo',
  bridge: { pid: 42, workspace: '/ws/p', expiresAt: new Date(Date.now() + 3600000).toISOString(), autoRenew: false },
  modelOverride: null,
  schedule: null,
};

const idleProject: Project = { ...project, bridge: null };

describe('BridgeSubTab', () => {
  beforeEach(() => {
    vi.mocked(bridgeApi.openBridgeLogs).mockReturnValue(mockWs as unknown as WebSocket);
    vi.mocked(projectsApi.getProject).mockResolvedValue(project);
  });

  it('shows filter input', () => {
    render(<BridgeSubTab project={project} onProjectChange={() => {}} />);
    expect(screen.getByPlaceholderText(/filter output/i)).toBeInTheDocument();
  });

  it('shows Auto-Renew toggle', () => {
    render(<BridgeSubTab project={project} onProjectChange={() => {}} />);
    expect(screen.getByText(/auto-renew/i)).toBeInTheDocument();
  });

  it('shows Stop and Renew buttons when active', () => {
    render(<BridgeSubTab project={project} onProjectChange={() => {}} />);
    expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /renew/i })).toBeInTheDocument();
  });
});

describe('FilesSubTab', () => {
  beforeEach(() => {
    vi.mocked(settingsApi.getClaudeMd).mockResolvedValue({ content: '# CLAUDE\nSome content.' });
  });

  it('renders CLAUDE.md section', async () => {
    render(<FilesSubTab project={project} />);
    await waitFor(() => expect(screen.getByText(/CLAUDE\.md/)).toBeInTheDocument());
  });
});

describe('TranscriptSubTab', () => {
  beforeEach(() => {
    vi.mocked(memoryApi.getTranscript).mockResolvedValue({ projectId: 'p', content: 'Human: Hello\nAssistant: Hi there' });
  });

  it('renders Raw / Chat toggle', async () => {
    render(<TranscriptSubTab project={project} />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /raw/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /chat/i })).toBeInTheDocument();
    });
  });
});

describe('ScheduleSubTab', () => {
  beforeEach(() => {
    vi.mocked(settingsApi.getProjectSchedule).mockResolvedValue({
      enabled: false, windows: [], warnLeadMinutes: 60, warnIntervalMinutes: 10, alertTemplate: '⏰',
    });
    vi.mocked(settingsApi.getGlobalScheduling).mockResolvedValue({
      enabled: false, windows: [], warnLeadMinutes: 60, warnIntervalMinutes: 10, alertTemplate: '⏰',
    });
  });

  it('renders inherit/custom toggle', async () => {
    render(<ScheduleSubTab project={project} />);
    await waitFor(() => expect(screen.getByText(/inherit global/i)).toBeInTheDocument());
  });
});
