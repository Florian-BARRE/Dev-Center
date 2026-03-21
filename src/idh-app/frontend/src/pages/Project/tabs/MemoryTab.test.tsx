import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import MemoryTab from './MemoryTab';
import * as memoryApi from '../../../api/memory';
import type { Project } from '../../../api/types';

vi.mock('../../../api/memory');
vi.mock('../../../components/MarkdownEditor', () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea data-testid="editor" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

const project: Project = {
  groupId: '-100g', projectId: 'p1', repoUrl: 'x', bridge: null, modelOverride: null
};

describe('MemoryTab', () => {
  it('loads and shows session memory content', async () => {
    vi.mocked(memoryApi.getSessionMemory).mockResolvedValue({ projectId: 'p1', content: '# Memory' });
    vi.mocked(memoryApi.getTranscript).mockResolvedValue({ projectId: 'p1', content: '' });
    render(<MemoryTab project={project} />);
    await waitFor(() => expect(screen.getByTestId('editor')).toHaveValue('# Memory'));
  });

  it('saves memory on Save click', async () => {
    vi.mocked(memoryApi.getSessionMemory).mockResolvedValue({ projectId: 'p1', content: '# Memory' });
    vi.mocked(memoryApi.getTranscript).mockResolvedValue({ projectId: 'p1', content: '' });
    vi.mocked(memoryApi.putSessionMemory).mockResolvedValue({ status: 'ok' });
    render(<MemoryTab project={project} />);
    await waitFor(() => screen.getByTestId('editor'));
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(memoryApi.putSessionMemory).toHaveBeenCalledWith('p1', '# Memory'));
  });

  it('shows transcript tab when clicked', async () => {
    vi.mocked(memoryApi.getSessionMemory).mockResolvedValue({ projectId: 'p1', content: '' });
    vi.mocked(memoryApi.getTranscript).mockResolvedValue({ projectId: 'p1', content: '{"type":"msg"}' });
    render(<MemoryTab project={project} />);
    await waitFor(() => screen.getByRole('button', { name: /transcript/i }));
    fireEvent.click(screen.getByRole('button', { name: /transcript/i }));
    await waitFor(() => expect(screen.getByText('{"type":"msg"}')).toBeInTheDocument());
  });
});
