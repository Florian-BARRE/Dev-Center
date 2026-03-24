import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import MonitoringPage from './MonitoringPage';
import * as projectsApi from '../../api/projects';
import * as monitoringApi from '../../api/monitoring';
import type { Project, ActivityEntry } from '../../api/types';

vi.mock('../../api/projects');
vi.mock('../../api/monitoring');

// Minimal WebSocket mock — EventFeed uses createMonitoringSocket internally.
const mockWs = {
  onopen: null,
  onmessage: null,
  onclose: null,
  onerror: null,
  close: vi.fn(),
};

const mockProjects: Project[] = [
  {
    groupId: 'grp-1',
    projectId: 'proj-a',
    repoUrl: 'https://github.com/foo/bar',
    bridge: { status: 'active', renewedAt: '2026-01-01T00:00:00Z', model: 'claude-3' },
    modelOverride: null,
    schedule: null,
  },
  {
    groupId: 'grp-2',
    projectId: 'proj-b',
    repoUrl: 'https://github.com/foo/baz',
    bridge: null,
    modelOverride: null,
    schedule: null,
  },
];

const today = new Date().toISOString().slice(0, 10);

const mockEntries: ActivityEntry[] = [
  { timestamp: `${today}T10:00:00Z`, groupId: 'grp-1', projectId: 'proj-a', event: 'session_started', level: 'info' },
  { timestamp: `${today}T11:00:00Z`, groupId: 'grp-1', projectId: 'proj-a', event: 'warning_sent', level: 'warning' },
  { timestamp: `${today}T12:00:00Z`, groupId: 'grp-2', projectId: 'proj-b', event: 'session_stopped', level: 'error' },
  { timestamp: `${today}T13:00:00Z`, groupId: 'grp-1', projectId: 'proj-a', event: 'session_renewed', level: 'info' },
  { timestamp: `${today}T14:00:00Z`, groupId: 'grp-2', projectId: 'proj-b', event: 'warning_sent', level: 'warning' },
];

describe('MonitoringPage', () => {
  beforeEach(() => {
    vi.mocked(projectsApi.listProjects).mockResolvedValue(mockProjects);
    vi.mocked(monitoringApi.getActivityLog).mockResolvedValue(mockEntries);
    vi.mocked(monitoringApi.createMonitoringSocket).mockReturnValue(
      mockWs as unknown as WebSocket,
    );
    // getTimeline may still be imported elsewhere; mock it to avoid unhandled rejections.
    if ('getTimeline' in monitoringApi) {
      vi.mocked(
        (monitoringApi as unknown as Record<string, ReturnType<typeof vi.fn>>).getTimeline,
      ).mockResolvedValue({ projects: [] });
    }
  });

  it('shows MONITORING header and LIVE indicator', async () => {
    render(<MemoryRouter><MonitoringPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('MONITORING')).toBeInTheDocument());
    // "LIVE" badge and "LIVE EVENTS" section label both match /live/i — use getAllByText.
    await waitFor(() => expect(screen.getAllByText(/live/i).length).toBeGreaterThan(0));
  });

  it('shows stats row with active project count', async () => {
    render(<MemoryRouter><MonitoringPage /></MemoryRouter>);
    // 1 out of 2 projects has a bridge — "1 active"
    await waitFor(() => expect(screen.getByText(/1 active/i)).toBeInTheDocument());
  });

  it('shows events today stat', async () => {
    render(<MemoryRouter><MonitoringPage /></MemoryRouter>);
    // All 5 entries are from today
    await waitFor(() => expect(screen.getByText(/5 events today/i)).toBeInTheDocument());
  });

  it('shows warnings stat', async () => {
    render(<MemoryRouter><MonitoringPage /></MemoryRouter>);
    // 2 warning_sent entries
    await waitFor(() => expect(screen.getByText(/2 warnings/i)).toBeInTheDocument());
  });

  it('shows errors stat', async () => {
    render(<MemoryRouter><MonitoringPage /></MemoryRouter>);
    // 1 session_stopped entry (level=error)
    await waitFor(() => expect(screen.getByText(/1 errors/i)).toBeInTheDocument());
  });

  it('shows LIVE EVENTS section header', async () => {
    render(<MemoryRouter><MonitoringPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('LIVE EVENTS')).toBeInTheDocument());
  });

  it('shows ACTIVITY LOG section header', async () => {
    render(<MemoryRouter><MonitoringPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/ACTIVITY LOG/i)).toBeInTheDocument());
  });

  it('renders project filter dropdown', async () => {
    render(<MemoryRouter><MonitoringPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('All projects')).toBeInTheDocument());
  });

  it('renders event type filter dropdown', async () => {
    render(<MemoryRouter><MonitoringPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('All events')).toBeInTheDocument());
  });
});
