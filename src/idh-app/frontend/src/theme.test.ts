import { theme } from './theme';

describe('theme tokens', () => {
  it('has accent token (electric cyan)', () => {
    expect(theme.colors.accent).toBe('#3ddcff');
  });

  it('has primary as alias for accent', () => {
    expect(theme.colors.primary).toBe('#3ddcff');
  });

  it('has border tokens', () => {
    expect(theme.colors.border).toBe('#1e1e3a');
    expect(theme.colors.borderAccent).toBe('#2d2d55');
  });

  it('has text color tokens', () => {
    expect(theme.colors.text).toBe('#e0e0f5');
    expect(theme.colors.textSecondary).toBe('#8888aa');
  });

  it('has JetBrains Mono in font.mono', () => {
    expect(theme.font.mono).toContain('JetBrains Mono');
  });

  it('has Syne in font.display', () => {
    expect(theme.font.display).toContain('Syne');
  });

  it('has Figtree in font.sans', () => {
    expect(theme.font.sans).toContain('Figtree');
  });

  it('has semantic color tokens', () => {
    expect(theme.colors.success).toBe('#22ddaa');
    expect(theme.colors.warning).toBe('#ffb340');
    expect(theme.colors.danger).toBe('#ff4070');
  });

  it('has onPrimary as dark bg for text on accent', () => {
    expect(theme.colors.onPrimary).toBe('#060610');
  });
});
