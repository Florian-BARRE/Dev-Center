import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import OverviewTab from './OverviewTab';
import * as settingsApi from '../../../api/settings';
import type { Project } from '../../../api/types';

vi.mock('../../../api/settings');

const project: Project = {
  groupId: '-100g',
  projectId: 'Patrimonium',
  repoUrl: 'https://github.com/test/repo',
  bridge: { pid: 42, workspace: '/ws/p', expiresAt: new Date(Date.now() + 3600000).toISOString(), autoRenew: false },
  modelOverride: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
  schedule: null,
};

describe('OverviewTab', () => {
  beforeEach(() => {
    vi.mocked(settingsApi.getContextSize).mockResolvedValue({
      total: 14200, claudeMd: 8400, systemPrompt: 4200, sessionMemory: 1600, estimatedMax: 200000,
    });
  });

  it('renders project name prominently', () => {
    render(<OverviewTab project={project} onProjectChange={() => {}} />);
    expect(screen.getByText('Patrimonium')).toBeInTheDocument();
  });

  it('renders repo URL as a link', () => {
    render(<OverviewTab project={project} onProjectChange={() => {}} />);
    const link = screen.getByRole('link', { name: /github\.com/i });
    expect(link).toBeInTheDocument();
  });

  it('renders model badge', () => {
    render(<OverviewTab project={project} onProjectChange={() => {}} />);
    expect(screen.getByText(/claude-sonnet-4-6/i)).toBeInTheDocument();
  });

  it('renders bridge status active', () => {
    render(<OverviewTab project={project} onProjectChange={() => {}} />);
    expect(screen.getByText(/active/i)).toBeInTheDocument();
    expect(screen.getByText(/PID 42/i)).toBeInTheDocument();
  });

  it('renders context size meter after load', async () => {
    render(<OverviewTab project={project} onProjectChange={() => {}} />);
    await waitFor(() => expect(screen.getByText(/14,200/)).toBeInTheDocument());
  });
});
