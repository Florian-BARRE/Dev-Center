import { describe, it, expect } from 'vitest';
import theme from './theme';

describe('theme', () => {
  it('exports a dark background color', () => {
    expect(theme.colors.bg).toMatch(/^#/);
    expect(theme.colors.bg.length).toBe(7);
  });

  it('exports display and mono fonts', () => {
    expect(theme.font.display.length).toBeGreaterThan(0);
    expect(theme.font.mono).toContain('JetBrains Mono');
  });
});
