import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import TelegramTab from './TelegramTab';
import * as settingsApi from '../../../api/settings';
import type { Project } from '../../../api/types';

vi.mock('../../../api/settings');

const project: Project = {
  groupId: '-100g',
  projectId: 'Patrimonium',
  repoUrl: 'https://github.com/test/repo',
  bridge: null,
  modelOverride: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
  schedule: null,
};

describe('TelegramTab', () => {
  beforeEach(() => {
    vi.mocked(settingsApi.getTelegramModel).mockResolvedValue({ provider: 'anthropic', model: 'claude-sonnet-4-6' });
    vi.mocked(settingsApi.getTelegramPrompt).mockResolvedValue({ agentId: 'p', systemPrompt: 'Hello' });
    vi.mocked(settingsApi.getContextSize).mockResolvedValue({ total: 1000, claudeMd: 200, systemPrompt: 400, sessionMemory: 400, estimatedMax: 200000 });
  });

  it('renders Telegram Model section', async () => {
    render(<TelegramTab project={project} />);
    await waitFor(() => expect(screen.getByText(/Telegram Model/i)).toBeInTheDocument());
  });

  it('renders System Prompt section', async () => {
    render(<TelegramTab project={project} />);
    await waitFor(() => expect(screen.getByText(/System Prompt/i)).toBeInTheDocument());
  });

  it('renders Quick Commands section', () => {
    render(<TelegramTab project={project} />);
    expect(screen.getByText(/Quick Commands/i)).toBeInTheDocument();
  });

  it('shows predefined command chips', () => {
    render(<TelegramTab project={project} />);
    expect(screen.getByText(/Show progress summary/i)).toBeInTheDocument();
  });
});
