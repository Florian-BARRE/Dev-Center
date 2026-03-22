import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import MonitoringPage from './MonitoringPage';
import * as projectsApi from '../../api/projects';
import * as monitoringApi from '../../api/monitoring';

vi.mock('../../api/projects');
vi.mock('../../api/monitoring');

describe('MonitoringPage', () => {
  beforeEach(() => {
    vi.mocked(projectsApi.listProjects).mockResolvedValue({ projects: [] });
    vi.mocked(monitoringApi.getTimeline).mockResolvedValue({ projects: [] });
    vi.mocked(monitoringApi.getActivityLog).mockResolvedValue({ entries: [] });
  });

  it('renders Stat cards section', async () => {
    render(<MemoryRouter><MonitoringPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/Total Projects/i)).toBeInTheDocument());
  });

  it('renders Session Timeline section', async () => {
    render(<MemoryRouter><MonitoringPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/Session Timeline/i)).toBeInTheDocument());
  });

  it('renders Activity Log section', async () => {
    render(<MemoryRouter><MonitoringPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/Activity Log/i)).toBeInTheDocument());
  });
});
