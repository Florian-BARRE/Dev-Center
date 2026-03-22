import { theme } from './theme';

describe('theme tokens', () => {
  it('has cta token (orange) not accent-as-orange', () => {
    expect(theme.colors.cta).toBe('#F97316');
    expect(theme.colors.ctaHover).toBe('#EA6C0A');
  });

  it('has accent token (purple)', () => {
    expect(theme.colors.accent).toBe('#8B5CF6');
    expect(theme.colors.accentHover).toBe('#7C3AED');
  });

  it('has new border tokens', () => {
    expect(theme.colors.borderSubtle).toBe('#161B22');
    expect(theme.colors.borderAccent).toBe('#30363D');
  });

  it('has updated primary color', () => {
    expect(theme.colors.primary).toBe('#2F81F7');
  });

  it('has textSecondary token', () => {
    expect(theme.colors.textSecondary).toBe('#8B949E');
  });

  it('has JetBrains Mono in font.mono', () => {
    expect(theme.font.mono).toContain('JetBrains Mono');
  });
});
