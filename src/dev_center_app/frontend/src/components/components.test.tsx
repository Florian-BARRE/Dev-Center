import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import StatusBadge from './StatusBadge';
import CountdownTimer from './CountdownTimer';
import ModelSelector from './ModelSelector';

describe('StatusBadge', () => {
  it('renders active badge', () => {
    const { container } = render(<StatusBadge status="active" />);
    expect(container.textContent).toContain('ACTIVE');
  });

  it('renders cloning badge', () => {
    const { container } = render(<StatusBadge status="cloning" />);
    expect(container.textContent).toContain('CLONING');
  });
});

describe('CountdownTimer', () => {
  it('renders without crashing', () => {
    const future = new Date(Date.now() + 3_600_000).toISOString();
    const { container } = render(<CountdownTimer expiresAt={future} />);
    expect(container.textContent).toMatch(/h|m|s/);
  });
});

describe('ModelSelector', () => {
  it('renders a select with model options', () => {
    const { container } = render(
      <ModelSelector provider="anthropic" model="claude-sonnet-4-6" onChange={() => {}} />
    );
    const select = container.querySelector('select');
    expect(select).toBeTruthy();
  });
});
