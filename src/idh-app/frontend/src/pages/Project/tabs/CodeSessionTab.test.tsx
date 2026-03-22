import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CodeSessionTab from './CodeSessionTab';
import * as bridgeApi from '../../../api/bridge';
import * as projectsApi from '../../../api/projects';
import * as settingsApi from '../../../api/settings';
import * as memoryApi from '../../../api/memory';
import type { Project } from '../../../api/types';

vi.mock('../../../api/bridge');
vi.mock('../../../api/projects');
vi.mock('../../../api/settings');
vi.mock('../../../api/memory');

const mockWs = { onmessage: null, close: vi.fn() };
const project: Project = {
  groupId: '-100g', projectId: 'Patrimonium', repoUrl: 'https://x',
  bridge: null, modelOverride: null, schedule: null,
};

function renderWithRoute(subPath = '') {
  vi.mocked(bridgeApi.openBridgeLogs).mockReturnValue(mockWs as unknown as WebSocket);
  vi.mocked(projectsApi.getProject).mockResolvedValue(project);
  vi.mocked(settingsApi.getClaudeMd).mockResolvedValue({ content: '' });
  vi.mocked(settingsApi.getProjectSchedule).mockResolvedValue({ enabled: false, windows: [], warnLeadMinutes: 60, warnIntervalMinutes: 10, alertTemplate: '' });
  vi.mocked(settingsApi.getGlobalScheduling).mockResolvedValue({ enabled: false, windows: [], warnLeadMinutes: 60, warnIntervalMinutes: 10, alertTemplate: '' });
  vi.mocked(memoryApi.getTranscript).mockResolvedValue({ projectId: 'p', content: '' });
  return render(
    <MemoryRouter initialEntries={[`/projects/-100g/code-session${subPath}`]}>
      <Routes>
        <Route path="/projects/:groupId/code-session/*" element={<CodeSessionTab project={project} onProjectChange={() => {}} />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('CodeSessionTab', () => {
  it('renders Bridge sub-tab by default', () => {
    renderWithRoute();
    // Multiple elements may contain "Bridge" (nav button + content); verify at least one exists
    expect(screen.getAllByText(/Bridge/i).length).toBeGreaterThan(0);
  });

  it('renders Files sub-tab link', () => {
    renderWithRoute();
    expect(screen.getByRole('button', { name: /files/i })).toBeInTheDocument();
  });

  it('renders Transcript sub-tab link', () => {
    renderWithRoute();
    expect(screen.getByRole('button', { name: /transcript/i })).toBeInTheDocument();
  });

  it('renders Schedule sub-tab link', () => {
    renderWithRoute();
    expect(screen.getByRole('button', { name: /schedule/i })).toBeInTheDocument();
  });
});
