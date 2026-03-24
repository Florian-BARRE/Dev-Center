import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SettingsPage from './SettingsPage';

vi.mock('../../api/settings', () => ({
  getSettings: vi.fn().mockResolvedValue({
    defaults: { defaultProvider: 'anthropic', defaultModel: 'claude-sonnet-4-6', defaultTtlHours: 8, renewThresholdMinutes: 30 },
    schedule: { enabled: false, ranges: [], days: [] },
  }),
  putSettings: vi.fn(),
  getGlobalRules: vi.fn().mockResolvedValue(''),
  putGlobalRules: vi.fn(),
}));
vi.mock('../../api/auth', () => ({
  getAuthStatus: vi.fn().mockResolvedValue({ authenticated: true, email: 'test@test.com' }),
  postLogin: vi.fn(),
}));
vi.mock('../../api/projects', () => ({
  listProjects: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../api/rules', () => ({
  getRules: vi.fn().mockResolvedValue({ content: '', globalRulesOutOfSync: false }),
}));

describe('SettingsPage', () => {
  it('renders Settings heading', () => {
    render(<SettingsPage />);
    expect(screen.getByText('Settings')).toBeTruthy();
  });

  it('shows tab buttons', () => {
    render(<SettingsPage />);
    expect(screen.getByText('DEFAULTS')).toBeTruthy();
    expect(screen.getByText('GLOBAL RULES')).toBeTruthy();
    expect(screen.getByText('AUTH')).toBeTruthy();
  });
});
