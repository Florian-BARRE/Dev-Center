import { render, screen } from '@testing-library/react';
import ActivityFeed from './ActivityFeed';
import TimelineChart from './TimelineChart';
import type { ActivityEntry, TimelineProject } from '../api/types';

const entries: ActivityEntry[] = [
  { timestamp: '2026-03-22T14:32:01Z', groupId: '-100', projectId: 'Patrimonium', event: 'Bridge started (PID 18293)', level: 'info' },
  { timestamp: '2026-03-22T14:30:00Z', groupId: '-200', projectId: 'Dev-Center', event: 'Alert sent', level: 'warning' },
];

const projects: TimelineProject[] = [
  {
    groupId: '-100',
    projectId: 'Patrimonium',
    windows: [
      { start: new Date(Date.now() - 3600000).toISOString(), end: new Date(Date.now() + 3600000).toISOString(), status: 'active' },
    ],
  },
];

describe('ActivityFeed', () => {
  it('renders event descriptions', () => {
    render(<ActivityFeed entries={entries} />);
    expect(screen.getByText(/Bridge started/)).toBeInTheDocument();
    expect(screen.getByText(/Alert sent/)).toBeInTheDocument();
  });

  it('renders project names', () => {
    render(<ActivityFeed entries={entries} />);
    expect(screen.getByText('Patrimonium')).toBeInTheDocument();
    expect(screen.getByText('Dev-Center')).toBeInTheDocument();
  });

  it('renders empty state when no entries', () => {
    render(<ActivityFeed entries={[]} />);
    expect(screen.getByText(/No activity/i)).toBeInTheDocument();
  });
});

describe('TimelineChart', () => {
  it('renders project rows', () => {
    render(<TimelineChart projects={projects} />);
    expect(screen.getByText('Patrimonium')).toBeInTheDocument();
  });

  it('renders "now" marker', () => {
    render(<TimelineChart projects={projects} />);
    expect(screen.getByText('now')).toBeInTheDocument();
  });

  it('renders empty state when no projects', () => {
    render(<TimelineChart projects={[]} />);
    expect(screen.getByText(/No schedule/i)).toBeInTheDocument();
  });
});
