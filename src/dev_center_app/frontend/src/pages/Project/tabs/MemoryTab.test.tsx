import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import MemoryTab from './MemoryTab';

vi.mock('../../../api/memory', () => ({
  getMemory: vi.fn().mockResolvedValue({
    files: [{ name: 'style.md', content: '# Style', updatedAt: '2026-01-01T00:00:00Z' }],
    hashDiscovered: true,
  }),
}));

describe('MemoryTab', () => {
  it('renders memory file name', async () => {
    render(<MemoryTab projectId="myproj" />);
    const file = await screen.findByText('style.md');
    expect(file).toBeTruthy();
  });
});
