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

function renderTab() {
  vi.mocked(bridgeApi.openBridgeLogs).mockReturnValue(mockWs as unknown as WebSocket);
  vi.mocked(projectsApi.getProject).mockResolvedValue(project);
  vi.mocked(settingsApi.getModel).mockResolvedValue({ provider: 'anthropic', model: 'claude-sonnet-4-6' });
  vi.mocked(settingsApi.getClaudeMd).mockResolvedValue({ content: '' });
  vi.mocked(settingsApi.getProjectSchedule).mockResolvedValue({ enabled: false, renewalTimes: [], days: [], warnLeadMinutes: 30, warnIntervalMinutes: 10, alertTemplate: '' });
  vi.mocked(memoryApi.getSessionMemory).mockResolvedValue({ projectId: 'p', content: '' });
  return render(
    <MemoryRouter initialEntries={['/projects/-100g/code-session']}>
      <Routes>
        <Route path="/projects/:groupId/code-session/*" element={<CodeSessionTab project={project} onProjectChange={() => {}} />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('CodeSessionTab', () => {
  it('renders Session Model section', () => {
    renderTab();
    expect(screen.getByText(/Session Model/i)).toBeInTheDocument();
  });

  it('renders Coding Rules section', () => {
    renderTab();
    expect(screen.getByText(/Coding Rules/i)).toBeInTheDocument();
  });

  it('renders Session Memory section', () => {
    renderTab();
    expect(screen.getAllByText(/Session Memory/i).length).toBeGreaterThan(0);
  });

  it('renders Start Session button', () => {
    renderTab();
    expect(screen.getByRole('button', { name: /start session/i })).toBeInTheDocument();
  });
});
