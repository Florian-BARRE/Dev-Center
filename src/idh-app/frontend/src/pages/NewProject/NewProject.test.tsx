import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import NewProjectPage from './NewProjectPage';
import * as projectsApi from '../../api/projects';

vi.mock('../../api/projects');
// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

describe('NewProjectPage wizard', () => {
  it('starts at Step 1 (repo URL input)', () => {
    render(<MemoryRouter><NewProjectPage /></MemoryRouter>);
    expect(screen.getByText(/step 1/i)).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('advances to Step 2 after entering repo URL', () => {
    render(<MemoryRouter><NewProjectPage /></MemoryRouter>);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'git@github.com:u/r.git' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText(/step 2/i)).toBeInTheDocument();
  });

  it('advances to Step 3 (confirm) after selecting model', () => {
    render(<MemoryRouter><NewProjectPage /></MemoryRouter>);
    // Step 1
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'git@github.com:u/r.git' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    // Step 2
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    // Should be on Step 3
    expect(screen.getByText(/step 3/i)).toBeInTheDocument();
    expect(screen.getByText(/git@github\.com/)).toBeInTheDocument();
  });

  it('calls createProject and navigates on confirm', async () => {
    vi.mocked(projectsApi.createProject).mockResolvedValue({
      groupId: '-1001234567890',
      projectId: 'r',
      repoUrl: 'git@github.com:u/r.git',
      bridge: null,
      modelOverride: null,
    });
    render(<MemoryRouter><NewProjectPage /></MemoryRouter>);
    // Step through wizard
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'git@github.com:u/r.git' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    // Step 3: the groupId field
    const groupInput = screen.getByPlaceholderText(/-\d+/);
    fireEvent.change(groupInput, { target: { value: '-1001234567890' } });
    fireEvent.click(screen.getByRole('button', { name: /create project/i }));
    await waitFor(() => expect(projectsApi.createProject).toHaveBeenCalled());
    expect(mockNavigate).toHaveBeenCalled();
  });
});
