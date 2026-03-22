import { render, screen } from '@testing-library/react';
import ContextSizeMeter from './ContextSizeMeter';
import type { ContextSizeResponse } from '../api/types';

const mockData: ContextSizeResponse = {
  total: 14200,
  claudeMd: 8400,
  systemPrompt: 4200,
  sessionMemory: 1600,
  estimatedMax: 200000,
};

describe('ContextSizeMeter', () => {
  it('renders total token count', () => {
    render(<ContextSizeMeter response={mockData} />);
    expect(screen.getByText(/14,200/)).toBeInTheDocument();
  });

  it('renders individual breakdown labels', () => {
    render(<ContextSizeMeter response={mockData} />);
    expect(screen.getByText(/CLAUDE\.md/i)).toBeInTheDocument();
    expect(screen.getByText(/System Prompt/i)).toBeInTheDocument();
    expect(screen.getByText(/SESSION_MEMORY/i)).toBeInTheDocument();
  });

  it('shows percentage', () => {
    render(<ContextSizeMeter response={mockData} />);
    // 14200 / 200000 = 7.1% → should show 7%
    expect(screen.getByText(/7%/)).toBeInTheDocument();
  });
});
