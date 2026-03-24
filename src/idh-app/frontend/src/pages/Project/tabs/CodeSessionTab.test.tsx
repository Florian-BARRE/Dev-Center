import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import CodeSessionTab from './CodeSessionTab';
import * as settingsApi from '../../../api/settings';

vi.mock('../../../api/settings');

describe('CodeSessionTab', () => {
  beforeEach(() => {
    vi.mocked(settingsApi.getModel).mockResolvedValue({ provider: 'anthropic', model: 'claude-sonnet-4-6' });
    vi.mocked(settingsApi.getClaudeMd).mockResolvedValue({ content: '# CLAUDE rules' });
    vi.mocked(settingsApi.getProjectSchedule).mockResolvedValue({
      enabled: false,
      renewalTimes: [],
      days: [],
      warnLeadMinutes: 30,
      warnIntervalMinutes: 10,
      alertTemplate: '',
    });
  });

  it('renders MODEL card title', async () => {
    render(<CodeSessionTab groupId="-100g" />);
    await waitFor(() => expect(screen.getAllByText(/model/i).length).toBeGreaterThan(0));
  });

  it('renders ACTIVE TIME RANGES card title', async () => {
    render(<CodeSessionTab groupId="-100g" />);
    await waitFor(() => expect(screen.getByText(/active time ranges/i)).toBeInTheDocument());
  });

  it('renders CLAUDE.MD RULES card title', async () => {
    render(<CodeSessionTab groupId="-100g" />);
    await waitFor(() => expect(screen.getByText(/claude\.md rules/i)).toBeInTheDocument());
  });

  it('loads and displays claude.md content in textarea', async () => {
    render(<CodeSessionTab groupId="-100g" />);
    await waitFor(() => {
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveValue('# CLAUDE rules');
    });
  });
});
