import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listProjects, getProject, createProject, deleteProject } from './projects';
import { getBridgeStatus, startBridge, stopBridge } from './bridge';
import { getGlobalCodingRules, putGlobalCodingRules } from './settings';
import { getSessionMemory, putSessionMemory } from './memory';

const mockFetch = vi.fn();
beforeEach(() => {
  global.fetch = mockFetch as unknown as typeof fetch;
  mockFetch.mockReset();
});

function makeResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status < 400,
    status,
    json: () => Promise.resolve(body),
  });
}

describe('projects API', () => {
  it('listProjects GETs /api/v1/projects', async () => {
    mockFetch.mockReturnValue(makeResponse({ projects: [] }));
    const result = await listProjects();
    expect(mockFetch).toHaveBeenCalledWith('/api/v1/projects', expect.any(Object));
    expect(result).toEqual({ projects: [] });
  });

  it('createProject POSTs with body', async () => {
    const project = { groupId: 'g1', projectId: 'p1', repoUrl: 'ssh://...', bridge: null, modelOverride: null };
    mockFetch.mockReturnValue(makeResponse(project));
    const result = await createProject({ groupId: 'g1', repoUrl: 'ssh://...', provider: 'anthropic', model: 'claude-sonnet-4-6' });
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/projects/',
      expect.objectContaining({ method: 'POST' })
    );
    expect(result.groupId).toBe('g1');
  });

  it('deleteProject sends DELETE', async () => {
    mockFetch.mockReturnValue(makeResponse({ groupId: 'g1', projectId: 'p1', repoUrl: 'x', bridge: null, modelOverride: null }));
    await deleteProject('g1');
    expect(mockFetch).toHaveBeenCalledWith('/api/v1/projects/g1', expect.objectContaining({ method: 'DELETE' }));
  });
});

describe('bridge API', () => {
  it('getBridgeStatus GETs the right path', async () => {
    mockFetch.mockReturnValue(makeResponse({ groupId: 'g1', bridge: null }));
    await getBridgeStatus('g1');
    expect(mockFetch).toHaveBeenCalledWith('/api/v1/bridge/g1', expect.any(Object));
  });

  it('startBridge POSTs to /start', async () => {
    mockFetch.mockReturnValue(makeResponse({ status: 'started' }));
    await startBridge('g1');
    expect(mockFetch).toHaveBeenCalledWith('/api/v1/bridge/g1/start', expect.objectContaining({ method: 'POST' }));
  });

  it('stopBridge sends DELETE', async () => {
    mockFetch.mockReturnValue(makeResponse({ status: 'stopped' }));
    await stopBridge('g1');
    expect(mockFetch).toHaveBeenCalledWith('/api/v1/bridge/g1', expect.objectContaining({ method: 'DELETE' }));
  });
});

describe('settings API', () => {
  it('getGlobalCodingRules GETs the right path', async () => {
    mockFetch.mockReturnValue(makeResponse({ content: '# Rules' }));
    await getGlobalCodingRules();
    expect(mockFetch).toHaveBeenCalledWith('/api/v1/settings/global/coding-rules', expect.any(Object));
  });

  it('putGlobalCodingRules PUTs with content', async () => {
    mockFetch.mockReturnValue(makeResponse({ status: 'ok' }));
    await putGlobalCodingRules('# Updated');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/settings/global/coding-rules',
      expect.objectContaining({ method: 'PUT' })
    );
  });
});

describe('memory API', () => {
  it('getSessionMemory GETs the right path', async () => {
    mockFetch.mockReturnValue(makeResponse({ projectId: 'p1', content: '# Memory' }));
    await getSessionMemory('p1');
    expect(mockFetch).toHaveBeenCalledWith('/api/v1/memory/p1/session-memory', expect.any(Object));
  });

  it('putSessionMemory PUTs with content', async () => {
    mockFetch.mockReturnValue(makeResponse({ status: 'ok' }));
    await putSessionMemory('p1', '# Updated');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/memory/p1/session-memory',
      expect.objectContaining({ method: 'PUT' })
    );
  });
});
