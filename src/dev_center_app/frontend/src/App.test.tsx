import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

// Mock API calls so tests don't make real network requests
vi.mock('./api/auth', () => ({
  getAuthStatus: vi.fn().mockResolvedValue({ authenticated: true, email: null }),
}));
vi.mock('./pages/Dashboard/Dashboard', () => ({
  default: ({ showNewProject }: { showNewProject?: boolean }) =>
    <div data-testid="dashboard">{showNewProject ? 'new-project' : 'dashboard'}</div>,
}));
vi.mock('./pages/Monitoring/MonitoringPage', () => ({
  default: () => <div data-testid="monitoring" />,
}));
vi.mock('./pages/Settings/SettingsPage', () => ({
  default: () => <div data-testid="settings" />,
}));
vi.mock('./pages/Project/ProjectPage', () => ({
  default: () => <div data-testid="project" />,
}));

describe('App', () => {
  it('renders nav and dashboard', async () => {
    render(<App />);
    const dashboard = await screen.findByTestId('dashboard');
    expect(dashboard).toBeTruthy();
    expect(screen.getByText('Dev Center')).toBeTruthy();
  });
});
