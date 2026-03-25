import { describe, it, expect } from 'vitest';
import theme from './theme';

describe('theme', () => {
  it('exports a bg color', () => {
    expect(theme.colors.bg).toBe('#0a0a0a');
  });

  it('exports font families', () => {
    expect(theme.font.sans).toContain('Inter');
    expect(theme.font.mono).toContain('JetBrains Mono');
  });
});
