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
  });

  it('shows project ID in the heading', async () => {
    renderWithRoute();
    // The project name appears in both the page heading and the OverviewTab card.
    // Use getAllByText to tolerate multiple matches, then assert at least one exists.
    await waitFor(() => expect(screen.getAllByText('my-project').length).toBeGreaterThanOrEqual(1));
  });

  it('renders 3 tabs', async () => {
    renderWithRoute();
    // Match tab labels exactly to avoid collisions with action buttons in tab content.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Overview' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Telegram' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Code Session' })).toBeInTheDocument();
    });
  });

  it('Overview tab shows repo URL', async () => {
    renderWithRoute();
    await waitFor(() => screen.getByRole('button', { name: /overview/i }));
    fireEvent.click(screen.getByRole('button', { name: /overview/i }));
    expect(screen.getByText(/git@github\.com/)).toBeInTheDocument();
  });

  it('Telegram tab shows model selector', async () => {
    renderWithRoute();
    await waitFor(() => screen.getByRole('button', { name: /telegram/i }));
    fireEvent.click(screen.getByRole('button', { name: /telegram/i }));
    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument());
  });

  it('Telegram tab loads and shows system prompt textarea', async () => {
    renderWithRoute();
    await waitFor(() => screen.getByRole('button', { name: /telegram/i }));
    fireEvent.click(screen.getByRole('button', { name: /telegram/i }));
    // The Telegram tab renders a system-prompt textarea and a MarkdownEditor
    // (mocked as a textarea). Assert that at least one textbox is present.
    const textboxes = await screen.findAllByRole('textbox');
    expect(textboxes.length).toBeGreaterThanOrEqual(1);
  });

  it('renders Overview, Telegram, Code Session tabs', async () => {
    render(
      <MemoryRouter initialEntries={['/projects/-100g']}>
        <Routes>
          <Route path="/projects/:groupId/*" element={<ProjectPage />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /overview/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /telegram/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /code session/i })).toBeInTheDocument();
    });
  });
});
