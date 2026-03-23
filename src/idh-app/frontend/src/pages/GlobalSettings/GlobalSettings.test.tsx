import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import SettingsPage from './SettingsPage';
import * as settingsApi from '../../api/settings';

vi.mock('../../api/settings');
vi.mock('../../components/MarkdownEditor', () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea data-testid="editor" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));
vi.mock('../../components/ScheduleEditor', () => ({
  default: () => <div data-testid="schedule-editor" />,
}));
vi.mock('../../components/ModelSelector', () => ({
  default: () => <div data-testid="model-selector" />,
}));

describe('GlobalSettings page', () => {
  beforeEach(() => {
    vi.mocked(settingsApi.getGlobalCodingRules).mockResolvedValue({ content: '# My Rules' });
    vi.mocked(settingsApi.getGlobalCommonContext).mockResolvedValue({ content: '# Context' });
    vi.mocked(settingsApi.getGlobalDefaults).mockResolvedValue({
      defaultProvider: 'anthropic', defaultModel: 'claude-sonnet-4-6',
      defaultBridgeTtlHours: 8, defaultTelegramPrompt: '',
    });
    vi.mocked(settingsApi.getGlobalScheduling).mockResolvedValue({
      enabled: false, renewalTimes: [], days: [], warnLeadMinutes: 30, warnIntervalMinutes: 10, alertTemplate: '',
    });
  });

  it('loads and displays coding rules content', async () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    await waitFor(() => {
      const editors = screen.getAllByTestId('editor');
      expect(editors[0]).toHaveValue('# My Rules');
    });
  });

  it('saves coding rules on button click', async () => {
    vi.mocked(settingsApi.putGlobalCodingRules).mockResolvedValue({ status: 'ok' });
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    await waitFor(() => screen.getAllByTestId('editor'));
    fireEvent.click(screen.getAllByRole('button', { name: /save/i })[0]);
    await waitFor(() => expect(settingsApi.putGlobalCodingRules).toHaveBeenCalledWith('# My Rules'));
  });

  it('renders Defaults tab', async () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('button', { name: /defaults/i })).toBeInTheDocument());
  });

  it('renders Scheduling tab', async () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('button', { name: /scheduling/i })).toBeInTheDocument());
  });
});
