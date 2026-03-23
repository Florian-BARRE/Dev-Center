import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import StatusBadge from './StatusBadge';
import CountdownTimer from './CountdownTimer';
import ModelSelector from './ModelSelector';
import { TimeRangeScheduler } from './TimeRangeScheduler';

describe('StatusBadge', () => {
  it('renders "SESSION ACTIVE" for active status', () => {
    render(<StatusBadge status="active" />);
    expect(screen.getByText('SESSION ACTIVE')).toBeInTheDocument();
  });

  it('renders "IDLE" for idle status', () => {
    render(<StatusBadge status="idle" />);
    expect(screen.getByText('IDLE')).toBeInTheDocument();
  });

  it('renders "WARN" for warning status', () => {
    render(<StatusBadge status="warning" />);
    expect(screen.getByText('WARN')).toBeInTheDocument();
  });

  it('renders "ERROR" for error status', () => {
    render(<StatusBadge status="error" />);
    expect(screen.getByText('ERROR')).toBeInTheDocument();
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

describe('TimeRangeScheduler', () => {
  it('renders an add range button when ranges are empty', () => {
    const { getByText } = render(
      <TimeRangeScheduler
        value={{ enabled: true, ranges: [], days: [] }}
        onChange={() => {}}
      />
    );
    expect(getByText(/add a range/i)).toBeInTheDocument();
  });

  it('calls onChange when a range is removed', () => {
    const onChange = vi.fn();
    const { getAllByTitle } = render(
      <TimeRangeScheduler
        value={{ enabled: true, ranges: [{ start: '08:00', end: '20:00' }], days: [] }}
        onChange={onChange}
      />
    );
    getAllByTitle(/remove/i)[0]?.click();
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ ranges: [] })
    );
  });
});
