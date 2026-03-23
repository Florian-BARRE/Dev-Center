import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import OverviewTab from './OverviewTab';
import * as settingsApi from '../../../api/settings';
import * as projectsApi from '../../../api/projects';
import * as bridgeApi from '../../../api/bridge';
import type { Project } from '../../../api/types';

vi.mock('../../../api/settings');
vi.mock('../../../api/projects');
vi.mock('../../../api/bridge');

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
    vi.mocked(projectsApi.getProject).mockResolvedValue(project);
    vi.mocked(settingsApi.getContextSize).mockResolvedValue({
      total: 14200, claudeMd: 8400, systemPrompt: 4200, sessionMemory: 1600, estimatedMax: 200000,
    });
    vi.mocked(bridgeApi.startBridge).mockResolvedValue({ status: 'ok' });
    vi.mocked(bridgeApi.stopBridge).mockResolvedValue({ status: 'ok' });
    vi.mocked(bridgeApi.renewBridge).mockResolvedValue({ status: 'ok' });
  });

  it('renders project name prominently', async () => {
    render(<OverviewTab groupId="-100g" />);
    await waitFor(() => expect(screen.getByText('Patrimonium')).toBeInTheDocument());
  });

  it('renders repo URL as a link', async () => {
    render(<OverviewTab groupId="-100g" />);
    await waitFor(() => {
      const link = screen.getByRole('link', { name: /github\.com/i });
      expect(link).toBeInTheDocument();
    });
  });

  it('renders model badge in telegram card', async () => {
    render(<OverviewTab groupId="-100g" />);
    await waitFor(() => expect(screen.getByText(/claude-sonnet-4-6/i)).toBeInTheDocument());
  });

  it('renders bridge status badge in session code card', async () => {
    render(<OverviewTab groupId="-100g" />);
    await waitFor(() => expect(screen.getByText(/session active/i)).toBeInTheDocument());
  });

  it('renders context size meter after load', async () => {
    render(<OverviewTab groupId="-100g" />);
    await waitFor(() => expect(screen.getByText(/14,200/)).toBeInTheDocument());
  });

  it('renders Stop and Renew buttons when bridge is active', async () => {
    render(<OverviewTab groupId="-100g" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Renew' })).toBeInTheDocument();
    });
  });

  it('renders Start button when bridge is null', async () => {
    vi.mocked(projectsApi.getProject).mockResolvedValue({ ...project, bridge: null });
    render(<OverviewTab groupId="-100g" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
    });
  });

  it('renders "Always active" badge in Telegram card', async () => {
    render(<OverviewTab groupId="-100g" />);
    await waitFor(() => expect(screen.getByText(/always active/i)).toBeInTheDocument());
  });
});
