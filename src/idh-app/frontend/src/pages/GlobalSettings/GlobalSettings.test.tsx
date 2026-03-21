import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import SettingsPage from './SettingsPage';
import * as settingsApi from '../../api/settings';

vi.mock('../../api/settings');
vi.mock('../../components/MarkdownEditor', () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea data-testid="editor" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

describe('GlobalSettings page', () => {
  it('loads and displays coding rules content', async () => {
    vi.mocked(settingsApi.getGlobalCodingRules).mockResolvedValue({ content: '# My Rules' });
    vi.mocked(settingsApi.getGlobalCommonContext).mockResolvedValue({ content: '# Context' });
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    await waitFor(() => {
      const editors = screen.getAllByTestId('editor');
      expect(editors[0]).toHaveValue('# My Rules');
    });
  });

  it('saves coding rules on button click', async () => {
    vi.mocked(settingsApi.getGlobalCodingRules).mockResolvedValue({ content: '# Rules' });
    vi.mocked(settingsApi.getGlobalCommonContext).mockResolvedValue({ content: '# Context' });
    vi.mocked(settingsApi.putGlobalCodingRules).mockResolvedValue({ status: 'ok' });
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    await waitFor(() => screen.getAllByTestId('editor'));
    fireEvent.click(screen.getAllByRole('button', { name: /save/i })[0]);
    await waitFor(() => expect(settingsApi.putGlobalCodingRules).toHaveBeenCalledWith('# Rules'));
  });
});
