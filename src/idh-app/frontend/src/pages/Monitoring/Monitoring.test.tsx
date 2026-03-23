import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import MonitoringPage from './MonitoringPage';
import * as projectsApi from '../../api/projects';
import * as monitoringApi from '../../api/monitoring';

vi.mock('../../api/projects');
vi.mock('../../api/monitoring');

const mockWs = { onopen: null, onmessage: null, onclose: null, onerror: null, close: vi.fn() };

describe('MonitoringPage', () => {
  beforeEach(() => {
    vi.mocked(projectsApi.listProjects).mockResolvedValue({ projects: [] });
    vi.mocked(monitoringApi.getTimeline).mockResolvedValue({ projects: [] });
    vi.mocked(monitoringApi.getActivityLog).mockResolvedValue({ entries: [] });
    vi.mocked(monitoringApi.createMonitoringSocket).mockReturnValue(mockWs as unknown as WebSocket);
  });

  it('renders Active Bridges stat card', async () => {
    render(<MemoryRouter><MonitoringPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/Active Bridges/i)).toBeInTheDocument());
  });

  it('renders Session Timeline section', async () => {
    render(<MemoryRouter><MonitoringPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getAllByText(/Session Timeline/i).length).toBeGreaterThan(0));
  });

  it('renders Activity Log section', async () => {
    render(<MemoryRouter><MonitoringPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getAllByText(/Activity Log/i).length).toBeGreaterThan(0));
  });
});
