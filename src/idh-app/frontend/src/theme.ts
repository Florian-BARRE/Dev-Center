// ====== Code Summary ======
// Design tokens for the IDH App — Linear/Vercel-style ops dashboard.
// Single source of truth for all colors, typography, spacing, and shadows.

export const theme = {
  colors: {
    bg: '#0a0a0a',
    surface: '#111111',
    surfaceHover: '#161616',
    border: '#222222',
    borderStrong: '#333333',

    text: '#fafafa',
    textSecondary: '#a1a1aa',
    muted: '#52525b',

    accent: '#ffffff',
    accentHover: '#e4e4e7',

    active: '#22c55e',
    activeGlow: 'rgba(34, 197, 94, 0.15)',
    warning: '#f97316',
    danger: '#ef4444',

    nav: '#111111',
    navBorder: '#1f1f1f',
  },

  font: {
    sans: "'Inter', sans-serif",
    mono: "'JetBrains Mono', monospace",
  },

  fontSize: {
    xs: '11px',
    sm: '12px',
    base: '13px',
    md: '14px',
    lg: '16px',
    xl: '20px',
    '2xl': '24px',
  },

  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
  },

  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    '2xl': '32px',
    '3xl': '48px',
  },

  radius: {
    sm: '3px',
    md: '6px',
    lg: '8px',
    full: '9999px',
  },

  nav: {
    height: '48px',
  },

  maxWidth: '1200px',
} as const;

export type Theme = typeof theme;
export default theme;
