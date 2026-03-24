import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProjectPage from './ProjectPage';
import type { Project } from '../../api/types';

const mockProject: Project = {
  id: 'myproj',
  name: 'myproj',
  repoUrl: 'https://github.com/u/myproj',
  workspacePath: '/workspaces/myproj',
  provider: 'anthropic',
  model: 'claude-sonnet-4-6',
  schedule: { enabled: false, ranges: [], days: [] },
  session: null,
  status: 'ready',
};

vi.mock('../../api/projects', () => ({
  getProject: vi.fn().mockResolvedValue({
    id: 'myproj',
    name: 'myproj',
    repoUrl: 'https://github.com/u/myproj',
    workspacePath: '/workspaces/myproj',
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    schedule: { enabled: false, ranges: [], days: [] },
    session: null,
    status: 'ready',
  }),
  updateProject: vi.fn(),
}));
vi.mock('../../api/sessions', () => ({
  startSession: vi.fn(),
  stopSession: vi.fn(),
  renewSession: vi.fn(),
}));
// LogPane opens a WebSocket on mount — stub it to avoid jsdom WS errors
vi.mock('../../components/LogPane', () => ({
  default: () => <div data-testid="log-pane" />,
}));

describe('ProjectPage', () => {
  it('renders project name', async () => {
    // mockProject referenced here only to satisfy TypeScript — actual mock data is inlined above
    void mockProject;
    render(
      <MemoryRouter initialEntries={['/projects/myproj']}>
        <Routes>
          <Route path="/projects/:projectId/*" element={<ProjectPage />} />
        </Routes>
      </MemoryRouter>
    );
    const name = await screen.findByText('myproj');
    expect(name).toBeTruthy();
  });
});
