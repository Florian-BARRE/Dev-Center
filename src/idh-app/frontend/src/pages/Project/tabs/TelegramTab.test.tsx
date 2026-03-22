import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import TelegramTab from './TelegramTab';
import * as settingsApi from '../../../api/settings';
import * as memoryApi from '../../../api/memory';
import type { Project } from '../../../api/types';

vi.mock('../../../api/settings');
vi.mock('../../../api/memory');

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
    vi.mocked(settingsApi.getModel).mockResolvedValue({ provider: 'anthropic', model: 'claude-sonnet-4-6' });
    vi.mocked(settingsApi.getTelegramPrompt).mockResolvedValue({ agentId: 'p', systemPrompt: 'Hello' });
    vi.mocked(memoryApi.getSessionMemory).mockResolvedValue({ projectId: 'p', content: 'memory text' });
  });

  it('renders AI Model section', async () => {
    render(<TelegramTab project={project} />);
    await waitFor(() => expect(screen.getByText(/AI Model/i)).toBeInTheDocument());
  });

  it('renders System Prompt section', async () => {
    render(<TelegramTab project={project} />);
    await waitFor(() => expect(screen.getByText(/System Prompt/i)).toBeInTheDocument());
  });

  it('renders SESSION_MEMORY section', async () => {
    render(<TelegramTab project={project} />);
    await waitFor(() => expect(screen.getByText(/SESSION_MEMORY/i)).toBeInTheDocument());
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
