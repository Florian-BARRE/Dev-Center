import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import * as projectsApi from '../../api/projects';
import * as monitoringApi from '../../api/monitoring';
import * as settingsApi from '../../api/settings';
import { Dashboard } from './Dashboard';

vi.mock('../../api/projects');
vi.mock('../../api/monitoring');
vi.mock('../../api/settings');

describe('Dashboard', () => {
  beforeEach(() => {
    vi.mocked(settingsApi.getTelegramModel).mockResolvedValue({ provider: 'anthropic', model: 'claude-opus-4-6' });
  });

  it('shows empty state when there are no projects', async () => {
    vi.mocked(projectsApi.listProjects).mockResolvedValue([]);
    vi.mocked(monitoringApi.getActivityLog).mockResolvedValue([]);
    const { findByText } = render(<MemoryRouter><Dashboard /></MemoryRouter>);
    await findByText(/no projects yet/i);
  });

  it('renders project cards when projects exist', async () => {
    vi.mocked(projectsApi.listProjects).mockResolvedValue([
      { groupId: '-123', projectId: 'my-proj', repoUrl: 'https://github.com/x/y', bridge: null }
    ]);
    vi.mocked(settingsApi.getTelegramModel).mockResolvedValue({ provider: 'anthropic', model: 'claude-opus-4-6' });
    vi.mocked(monitoringApi.getActivityLog).mockResolvedValue([]);
    const { findByText } = render(<MemoryRouter><Dashboard /></MemoryRouter>);
    await findByText('my-proj');
  });
});
