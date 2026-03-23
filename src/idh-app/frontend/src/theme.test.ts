import { describe, it, expect } from 'vitest';
import theme from './theme';

describe('theme', () => {
  it('exports required color tokens', () => {
    expect(theme.colors.bg).toBe('#0a0a0a');
    expect(theme.colors.surface).toBe('#111111');
    expect(theme.colors.active).toBe('#22c55e');
    expect(theme.colors.warning).toBe('#f97316');
    expect(theme.colors.danger).toBe('#ef4444');
  });

  it('exports Inter and JetBrains Mono fonts', () => {
    expect(theme.font.sans).toContain('Inter');
    expect(theme.font.mono).toContain('JetBrains Mono');
  });

  it('exports nav height', () => {
    expect(theme.nav.height).toBe('48px');
  });
});
