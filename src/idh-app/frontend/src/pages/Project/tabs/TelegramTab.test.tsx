import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import TelegramTab from './TelegramTab';
import * as settingsApi from '../../../api/settings';

vi.mock('../../../api/settings');

describe('TelegramTab', () => {
  beforeEach(() => {
    vi.mocked(settingsApi.getTelegramModel).mockResolvedValue({ provider: 'anthropic', model: 'claude-sonnet-4-6' });
    vi.mocked(settingsApi.getTelegramPrompt).mockResolvedValue({ agentId: 'p', systemPrompt: 'Hello' });
  });

  it('renders MODEL card title', async () => {
    render(<TelegramTab groupId="-100g" />);
    await waitFor(() => expect(screen.getByText(/model/i)).toBeInTheDocument());
  });

  it('renders CUSTOM PROMPT card title', async () => {
    render(<TelegramTab groupId="-100g" />);
    await waitFor(() => expect(screen.getByText(/custom prompt/i)).toBeInTheDocument());
  });

  it('renders two Save buttons', async () => {
    render(<TelegramTab groupId="-100g" />);
    await waitFor(() => {
      const saveButtons = screen.getAllByRole('button', { name: /save/i });
      expect(saveButtons.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('loads and displays system prompt text', async () => {
    render(<TelegramTab groupId="-100g" />);
    await waitFor(() => {
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveValue('Hello');
    });
  });
});
