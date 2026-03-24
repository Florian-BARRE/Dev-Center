import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';

vi.mock('../../api/projects', () => ({
  listProjects: vi.fn().mockResolvedValue([]),
  createProject: vi.fn(),
}));

describe('Dashboard', () => {
  it('renders without crashing', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );
    const total = await screen.findByText('total');
    expect(total).toBeTruthy();
  });
});
