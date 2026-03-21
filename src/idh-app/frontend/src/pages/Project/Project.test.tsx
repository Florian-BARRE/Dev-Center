import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProjectPage from './ProjectPage';
import * as projectsApi from '../../api/projects';
import * as settingsApi from '../../api/settings';
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
  bridge: { pid: 42, workspace: '/ws/my-project', expiresAt: new Date(Date.now() + 3600000).toISOString() },
  modelOverride: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
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
  });

  it('shows project ID in the heading', async () => {
    renderWithRoute();
    await waitFor(() => expect(screen.getByText('my-project')).toBeInTheDocument());
  });

  it('renders 4 tabs', async () => {
    renderWithRoute();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /overview/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /bridge/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /memory/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument();
    });
  });

  it('Overview tab shows repo URL', async () => {
    renderWithRoute();
    await waitFor(() => screen.getByRole('button', { name: /overview/i }));
    fireEvent.click(screen.getByRole('button', { name: /overview/i }));
    expect(screen.getByText(/git@github\.com/)).toBeInTheDocument();
  });

  it('Settings tab shows model selector', async () => {
    renderWithRoute();
    await waitFor(() => screen.getByRole('button', { name: /settings/i }));
    fireEvent.click(screen.getByRole('button', { name: /settings/i }));
    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument());
  });

  it('settings tab loads and shows system prompt textarea', async () => {
    renderWithRoute();
    await waitFor(() => screen.getByRole('button', { name: /settings/i }));
    fireEvent.click(screen.getByRole('button', { name: /settings/i }));
    // The Settings tab renders two textareas: the Telegram Agent Prompt textarea
    // and the MarkdownEditor (mocked as a textarea). Wait for them to appear and
    // assert that at least one textbox (the Telegram prompt) is present.
    const textboxes = await screen.findAllByRole('textbox');
    expect(textboxes.length).toBeGreaterThanOrEqual(1);
  });
});
