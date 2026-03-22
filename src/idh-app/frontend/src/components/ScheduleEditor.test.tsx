import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import ScheduleEditor from './ScheduleEditor';
import type { ScheduleConfig } from '../api/types';

const defaultConfig: ScheduleConfig = {
  enabled: false,
  windows: [],
  warnLeadMinutes: 60,
  warnIntervalMinutes: 10,
  alertTemplate: '⏰ Session ending in {remaining}.',
};

describe('ScheduleEditor', () => {
  it('renders enabled toggle', () => {
    render(<ScheduleEditor value={defaultConfig} onChange={() => {}} />);
    expect(screen.getByText(/schedule enabled/i)).toBeInTheDocument();
  });

  it('calls onChange when enabled toggle is clicked', () => {
    const onChange = vi.fn();
    render(<ScheduleEditor value={defaultConfig} onChange={onChange} />);
    const toggle = screen.getByRole('checkbox', { name: /schedule enabled/i });
    fireEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }));
  });

  it('shows Add window button', () => {
    render(<ScheduleEditor value={defaultConfig} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /add window/i })).toBeInTheDocument();
  });

  it('calls onChange with new window when Add window is clicked', () => {
    const onChange = vi.fn();
    render(<ScheduleEditor value={defaultConfig} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /add window/i }));
    const call = onChange.mock.calls[0][0] as ScheduleConfig;
    expect(call.windows).toHaveLength(1);
    expect(call.windows[0].startTime).toBe('00:00');
  });

  it('renders a window row when windows are provided', () => {
    const config: ScheduleConfig = {
      ...defaultConfig,
      windows: [{ startTime: '08:00', endTime: '16:00', days: ['mon', 'tue'] }],
    };
    render(<ScheduleEditor value={config} onChange={() => {}} />);
    expect(screen.getByDisplayValue('08:00')).toBeInTheDocument();
    expect(screen.getByDisplayValue('16:00')).toBeInTheDocument();
  });

  it('removes a window when × button is clicked', () => {
    const onChange = vi.fn();
    const config: ScheduleConfig = {
      ...defaultConfig,
      windows: [{ startTime: '08:00', endTime: '16:00', days: ['mon'] }],
    };
    render(<ScheduleEditor value={config} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /remove window/i }));
    const call = onChange.mock.calls[0][0] as ScheduleConfig;
    expect(call.windows).toHaveLength(0);
  });
});
