import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MonitoringPage from './MonitoringPage';

vi.mock('../../api/monitoring', () => ({
  getMonitoring: vi.fn().mockResolvedValue({ projects: [] }),
}));
// EventFeed opens a WebSocket — stub it
vi.mock('../../components/EventFeed', () => ({
  default: () => <div data-testid="event-feed" />,
}));

describe('MonitoringPage', () => {
  it('renders the events feed panel', async () => {
    render(
      <MemoryRouter>
        <MonitoringPage />
      </MemoryRouter>
    );
    // The stub returns <div>Monitoring</div> — the real component renders an
    // EventFeed (stubbed as data-testid="event-feed") which the stub does not.
    const feed = await screen.findByTestId('event-feed');
    expect(feed).toBeTruthy();
  });
});
