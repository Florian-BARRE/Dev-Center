import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProjectPage from './ProjectPage';
import * as projectsApi from '../../api/projects';
import * as settingsApi from '../../api/settings';
import * as bridgeApi from '../../api/bridge';
import type { Project } from '../../api/types';

vi.mock('../../api/projects');
vi.mock('../../api/settings');
vi.mock('../../api/bridge');
vi.mock('../../api/memory');
vi.mock('../../components/MarkdownEditor', () => ({
  default: ({ value }: { value: string }) => <textarea data-testid="editor" defaultValue={value} />,
}));

const mockProject: Project = {
  groupId: '-1001234567890',
  projectId: 'my-project',
  repoUrl: 'git@github.com:u/r.git',
  bridge: { pid: 42, workspace: '/ws/my-project', expiresAt: new Date(Date.now() + 3600000).toISOString(), autoRenew: false },
  modelOverride: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
  schedule: null,
};

function renderWithRoute(groupId = '-1001234567890') {
  return render(
    <MemoryRouter initialEntries={[`/projects/${encodeURIComponent(groupId)}`]}>
      <Routes>
        <Route path="/projects/:groupId/*" element={<ProjectPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ProjectPage', () => {
  beforeEach(() => {
    vi.mocked(projectsApi.getProject).mockResolvedValue(mockProject);
    vi.mocked(settingsApi.getModel).mockResolvedValue({ provider: 'anthropic', model: 'claude-sonnet-4-6' });
    vi.mocked(settingsApi.getTelegramPrompt).mockResolvedValue({ agentId: 'my-project', systemPrompt: '' });
    vi.mocked(settingsApi.getClaudeMd).mockResolvedValue({ content: '# CLAUDE' });
    vi.mocked(settingsApi.getContextSize).mockResolvedValue({
      total: 10000, claudeMd: 5000, systemPrompt: 3000, sessionMemory: 2000, estimatedMax: 200000,
    });
    vi.mocked(bridgeApi.startBridge).mockResolvedValue({ status: 'ok' });
    vi.mocked(bridgeApi.stopBridge).mockResolvedValue({ status: 'ok' });
    vi.mocked(bridgeApi.renewBridge).mockResolvedValue({ status: 'ok' });
  });

  it('renders breadcrumb and tab bar', async () => {
    renderWithRoute();
    await screen.findByText('← Projects');
    await screen.findByText('OVERVIEW');
    await screen.findByText('SESSION TELEGRAM');
    await screen.findByText('SESSION CODE');
  });

  it('shows project ID in the heading', async () => {
    renderWithRoute();
    // The project name appears in the header strip
    await waitFor(() => expect(screen.getAllByText('my-project').length).toBeGreaterThanOrEqual(1));
  });

  it('renders 3 tab links (OVERVIEW, SESSION TELEGRAM, SESSION CODE)', async () => {
    renderWithRoute();
    await screen.findByText('OVERVIEW');
    await screen.findByText('SESSION TELEGRAM');
    await screen.findByText('SESSION CODE');
  });

  it('renders Stop and Renew buttons when bridge is active', async () => {
    renderWithRoute();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Renew' })).toBeInTheDocument();
    });
  });

  it('renders Start button when bridge is null', async () => {
    vi.mocked(projectsApi.getProject).mockResolvedValue({ ...mockProject, bridge: null });
    renderWithRoute();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
    });
  });

  it('renders Overview, SESSION TELEGRAM, SESSION CODE tabs', async () => {
    render(
      <MemoryRouter initialEntries={['/projects/-100g']}>
        <Routes>
          <Route path="/projects/:groupId/*" element={<ProjectPage />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('OVERVIEW')).toBeInTheDocument();
      expect(screen.getByText('SESSION TELEGRAM')).toBeInTheDocument();
      expect(screen.getByText('SESSION CODE')).toBeInTheDocument();
    });
  });
});
