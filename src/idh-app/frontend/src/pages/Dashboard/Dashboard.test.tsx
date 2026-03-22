import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';
import ProjectCard from './ProjectCard';  // static import — required for vitest compatibility
import * as projectsApi from '../../api/projects';
import type { Project } from '../../api/types';

vi.mock('../../api/projects');

const mockProject: Project = {
  groupId: '-1001234567890',
  projectId: 'my-project',
  repoUrl: 'git@github.com:user/my-project.git',
  bridge: { pid: 123, workspace: '/workspaces/my-project', expiresAt: new Date(Date.now() + 3600000).toISOString() },
  modelOverride: { provider: 'openai-codex', model: 'gpt-5.3-codex' },
};

describe('Dashboard', () => {
  it('shows a loading state then renders project cards', async () => {
    vi.mocked(projectsApi.listProjects).mockResolvedValue({ projects: [mockProject] });
    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    // Initially loading
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    // After fetch
    await waitFor(() => expect(screen.getByText('my-project')).toBeInTheDocument());
  });

  it('shows "no projects" message when list is empty', async () => {
    vi.mocked(projectsApi.listProjects).mockResolvedValue({ projects: [] });
    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/no projects/i)).toBeInTheDocument());
  });

  it('renders a link to create a new project', async () => {
    vi.mocked(projectsApi.listProjects).mockResolvedValue({ projects: [] });
    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('link', { name: /new project/i })).toBeInTheDocument());
  });
});

describe('ProjectCard', () => {
  it('renders project ID and repo URL', () => {
    render(<MemoryRouter><ProjectCard project={mockProject} /></MemoryRouter>);
    expect(screen.getByText('my-project')).toBeInTheDocument();
    expect(screen.getByText(/my-project\.git/)).toBeInTheDocument();
  });

  it('shows bridge active badge when bridge is running', () => {
    render(<MemoryRouter><ProjectCard project={mockProject} /></MemoryRouter>);
    expect(screen.getByText('LIVE')).toBeInTheDocument();
  });

  it('shows idle badge when no bridge', () => {
    render(<MemoryRouter><ProjectCard project={{ ...mockProject, bridge: null }} /></MemoryRouter>);
    expect(screen.getByText('IDLE')).toBeInTheDocument();
  });
});
