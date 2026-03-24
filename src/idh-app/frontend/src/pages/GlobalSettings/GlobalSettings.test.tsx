import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import SettingsPage from './SettingsPage';
import * as settingsApi from '../../api/settings';

vi.mock('../../api/settings');
vi.mock('../../components/TimeRangeScheduler', () => ({
  TimeRangeScheduler: () => <div data-testid="time-range-scheduler" />,
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

  it('renders the TELEGRAM tab by default', async () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('button', { name: /telegram/i })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /code session/i })).toBeInTheDocument();
  });

  it('renders model selector in TELEGRAM tab', async () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('model-selector')).toBeInTheDocument());
  });

  it('loads and displays common context in TELEGRAM tab', async () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    await waitFor(() => {
      const textareas = screen.getAllByRole('textbox');
      // The common context textarea should contain the loaded value.
      const ctxArea = textareas.find((el) => (el as HTMLTextAreaElement).value === '# Context');
      expect(ctxArea).toBeDefined();
    });
  });

  it('saves common context on button click', async () => {
    vi.mocked(settingsApi.putGlobalCommonContext).mockResolvedValue({ status: 'ok' });
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    // Wait for data to load — at least two Save buttons appear in the TELEGRAM tab.
    await waitFor(() => {
      const btns = screen.getAllByRole('button', { name: /^save$/i });
      expect(btns.length).toBeGreaterThanOrEqual(2);
    });
    const saveButtons = screen.getAllByRole('button', { name: /^save$/i });
    // Second Save button is for the Default context card (first is Default model).
    fireEvent.click(saveButtons[1]);
    await waitFor(() =>
      expect(settingsApi.putGlobalCommonContext).toHaveBeenCalledWith('# Context')
    );
  });

  it('loads and displays coding rules in CODE SESSION tab', async () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    // Switch to CODE SESSION tab.
    await waitFor(() => screen.getByRole('button', { name: /code session/i }));
    fireEvent.click(screen.getByRole('button', { name: /code session/i }));
    await waitFor(() => {
      const textareas = screen.getAllByRole('textbox');
      const rulesArea = textareas.find((el) => (el as HTMLTextAreaElement).value === '# My Rules');
      expect(rulesArea).toBeDefined();
    });
  });

  it('saves coding rules on button click in CODE SESSION tab', async () => {
    vi.mocked(settingsApi.putGlobalCodingRules).mockResolvedValue({ status: 'ok' });
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    await waitFor(() => screen.getByRole('button', { name: /code session/i }));
    fireEvent.click(screen.getByRole('button', { name: /code session/i }));
    await waitFor(() => screen.getAllByRole('button', { name: /^save$/i }));
    const saveButtons = screen.getAllByRole('button', { name: /^save$/i });
    // First Save in CODE SESSION is for Global coding rules.
    fireEvent.click(saveButtons[0]);
    await waitFor(() =>
      expect(settingsApi.putGlobalCodingRules).toHaveBeenCalledWith('# My Rules')
    );
  });

  it('renders TimeRangeScheduler in CODE SESSION tab', async () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    await waitFor(() => screen.getByRole('button', { name: /code session/i }));
    fireEvent.click(screen.getByRole('button', { name: /code session/i }));
    await waitFor(() =>
      expect(screen.getByTestId('time-range-scheduler')).toBeInTheDocument()
    );
  });
});
