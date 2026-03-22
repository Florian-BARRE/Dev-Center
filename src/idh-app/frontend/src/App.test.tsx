import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import App from './App';

vi.mock('./pages/Dashboard/Dashboard', () => ({
  default: () => <div data-testid="dashboard">Dashboard</div>,
}));
vi.mock('./pages/Project/ProjectPage', () => ({
  default: () => <div data-testid="project">Project</div>,
}));
vi.mock('./pages/NewProject/NewProjectPage', () => ({
  default: () => <div data-testid="new-project">NewProject</div>,
}));
vi.mock('./pages/GlobalSettings/SettingsPage', () => ({
  default: () => <div data-testid="settings">Settings</div>,
}));
vi.mock('./pages/Monitoring/MonitoringPage', () => ({
  default: () => <div data-testid="monitoring">Monitoring</div>,
}));
vi.mock('./api/projects', () => ({
  listProjects: vi.fn(() => Promise.resolve({ projects: [] })),
}));

describe('App router', () => {
  it('renders Dashboard at /', () => {
    render(<App />);
    expect(screen.getByTestId('dashboard')).toBeInTheDocument();
  });
});
