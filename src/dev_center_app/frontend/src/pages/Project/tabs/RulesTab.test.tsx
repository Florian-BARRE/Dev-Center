import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import RulesTab from './RulesTab';

vi.mock('../../../api/rules', () => ({
  getRules: vi.fn().mockResolvedValue({
    content: '<!-- dev-center: global-rules-start -->\nsome rule\n<!-- dev-center: global-rules-end -->\nmy rules',
    globalRulesOutOfSync: false,
  }),
  putRules: vi.fn(),
  syncRules: vi.fn(),
}));

describe('RulesTab', () => {
  it('renders project rules section', async () => {
    render(<RulesTab projectId="myproj" />);
    const heading = await screen.findByText(/project rules/i);
    expect(heading).toBeTruthy();
  });
});
