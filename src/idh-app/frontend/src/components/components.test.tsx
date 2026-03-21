import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import StatusBadge from './StatusBadge';
import CountdownTimer from './CountdownTimer';
import ModelSelector from './ModelSelector';

describe('StatusBadge', () => {
  it('renders "Active" for active status', () => {
    render(<StatusBadge status="active" />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders "Idle" for idle status', () => {
    render(<StatusBadge status="idle" />);
    expect(screen.getByText('Idle')).toBeInTheDocument();
  });

  it('renders "Warning" for warning status', () => {
    render(<StatusBadge status="warning" />);
    expect(screen.getByText('Warning')).toBeInTheDocument();
  });
});

describe('CountdownTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows "Expired" when expiresAt is in the past', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    render(<CountdownTimer expiresAt={past} />);
    expect(screen.getByText('Expired')).toBeInTheDocument();
  });

  it('shows formatted countdown when expiry is in the future', () => {
    const future = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // 2h from now
    render(<CountdownTimer expiresAt={future} />);
    expect(screen.getByText(/2h/)).toBeInTheDocument();
  });
});

describe('ModelSelector', () => {
  it('calls onChange with provider and model', () => {
    const onChange = vi.fn();
    render(
      <ModelSelector
        provider="openai-codex"
        model="gpt-5.3-codex"
        onChange={onChange}
      />
    );
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'anthropic|claude-opus-4-6' } });
    expect(onChange).toHaveBeenCalledWith('anthropic', 'claude-opus-4-6');
  });

  it('shows current selection', () => {
    render(
      <ModelSelector provider="anthropic" model="claude-sonnet-4-6" onChange={() => {}} />
    );
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('anthropic|claude-sonnet-4-6');
  });
});
