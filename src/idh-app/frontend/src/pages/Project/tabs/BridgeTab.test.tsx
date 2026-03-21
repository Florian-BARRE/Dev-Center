import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import BridgeTab from './BridgeTab';
import * as bridgeApi from '../../../api/bridge';
import * as projectsApi from '../../../api/projects';
import type { Project } from '../../../api/types';

vi.mock('../../../api/bridge');
vi.mock('../../../api/projects');

// Provide a minimal WebSocket stand-in for openBridgeLogs cleanup
const mockWs = { onmessage: null as unknown, close: vi.fn() };

const activeProject: Project = {
  groupId: '-100g',
  projectId: 'p',
  repoUrl: 'x',
  bridge: { pid: 42, workspace: '/ws/p', expiresAt: new Date(Date.now() + 3600000).toISOString() },
  modelOverride: null,
};

const idleProject: Project = { ...activeProject, bridge: null };

describe('BridgeTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(projectsApi.getProject).mockResolvedValue(idleProject);
    // Return a mock WebSocket so the cleanup (ws.close) does not throw
    vi.mocked(bridgeApi.openBridgeLogs).mockReturnValue(mockWs as unknown as WebSocket);
  });

  it('shows Start button and no URL when bridge is idle', () => {
    render(<BridgeTab project={idleProject} onProjectChange={() => {}} />);
    expect(screen.getByRole('button', { name: /start bridge/i })).toBeInTheDocument();
    expect(screen.queryByText(/claude\.ai/)).not.toBeInTheDocument();
  });

  it('shows Stop and Renew buttons when bridge is active', () => {
    render(<BridgeTab project={activeProject} onProjectChange={() => {}} />);
    expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /renew/i })).toBeInTheDocument();
  });

  it('calls startBridge and refreshes project on Start click', async () => {
    vi.mocked(bridgeApi.startBridge).mockResolvedValue({ status: 'started' });
    vi.mocked(projectsApi.getProject).mockResolvedValue(idleProject);
    const onProjectChange = vi.fn();
    render(<BridgeTab project={idleProject} onProjectChange={onProjectChange} />);
    fireEvent.click(screen.getByRole('button', { name: /start bridge/i }));
    await waitFor(() => expect(bridgeApi.startBridge).toHaveBeenCalledWith('-100g'));
    expect(onProjectChange).toHaveBeenCalled();
  });

  it('calls stopBridge on Stop click', async () => {
    vi.mocked(bridgeApi.stopBridge).mockResolvedValue({ status: 'stopped' });
    vi.mocked(projectsApi.getProject).mockResolvedValue(activeProject);
    const onProjectChange = vi.fn();
    render(<BridgeTab project={activeProject} onProjectChange={onProjectChange} />);
    fireEvent.click(screen.getByRole('button', { name: /stop/i }));
    await waitFor(() => expect(bridgeApi.stopBridge).toHaveBeenCalledWith('-100g'));
  });
});
