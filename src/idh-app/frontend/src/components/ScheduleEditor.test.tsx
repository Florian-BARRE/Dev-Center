import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import ScheduleEditor from './ScheduleEditor';
import type { ScheduleConfig } from '../api/types';

const defaultConfig: ScheduleConfig = {
  enabled: false,
  renewalTimes: [],
  days: [],
  warnLeadMinutes: 30,
  warnIntervalMinutes: 10,
  alertTemplate: '⏰ Session renewing in {remaining}.',
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

  it('shows Add time button', () => {
    render(<ScheduleEditor value={defaultConfig} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /add renewal time/i })).toBeInTheDocument();
  });

  it('calls onChange with new renewal time when Add time is clicked', () => {
    const onChange = vi.fn();
    render(<ScheduleEditor value={defaultConfig} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /add renewal time/i }));
    const call = onChange.mock.calls[0][0] as ScheduleConfig;
    expect(call.renewalTimes).toHaveLength(1);
    expect(call.renewalTimes[0]).toBe('08:00');
  });

  it('renders a time input when renewalTimes are provided', () => {
    const config: ScheduleConfig = {
      ...defaultConfig,
      renewalTimes: ['08:00', '16:00'],
    };
    render(<ScheduleEditor value={config} onChange={() => {}} />);
    expect(screen.getByDisplayValue('08:00')).toBeInTheDocument();
    expect(screen.getByDisplayValue('16:00')).toBeInTheDocument();
  });

  it('removes a renewal time when × button is clicked', () => {
    const onChange = vi.fn();
    const config: ScheduleConfig = {
      ...defaultConfig,
      renewalTimes: ['08:00'],
    };
    render(<ScheduleEditor value={config} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /remove renewal time/i }));
    const call = onChange.mock.calls[0][0] as ScheduleConfig;
    expect(call.renewalTimes).toHaveLength(0);
  });
});
