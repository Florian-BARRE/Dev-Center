// ====== Code Summary ======
// Shared design tokens for the Dev Center frontend.

export const theme = {
  colors: {
    bg: '#071419',
    surface: '#0f2128',
    surfaceHover: '#16313a',
    border: '#1d4350',
    borderStrong: '#2f6472',

    text: '#e7f7f4',
    textSecondary: '#9dcac1',
    muted: '#5d8b84',

    accent: '#59e1c6',
    accentHover: '#7ff0d8',
    accentGlow: 'rgba(89, 225, 198, 0.16)',

    active: '#4fd271',
    activeGlow: 'rgba(79, 210, 113, 0.16)',
    warning: '#ffbc60',
    danger: '#ff7a7a',
    info: '#69c1ff',

    nav: 'rgba(7, 20, 25, 0.92)',
    navBorder: '#1d4350',

    logDebug: '#436b79',
    logInfo: '#69c1ff',
    logSuccess: '#4fd271',
    logWarning: '#ffbc60',
    logError: '#ff7a7a',
    logCritical: '#ff4d4d',
  },

  font: {
    display: "'Space Grotesk', 'IBM Plex Mono', sans-serif",
    sans: "'IBM Plex Mono', monospace",
    mono: "'JetBrains Mono', monospace",
  },

  fontSize: {
    xs: '11px',
    sm: '12px',
    base: '13px',
    md: '14px',
    lg: '16px',
    xl: '21px',
    '2xl': '26px',
    '3xl': '30px',
  },

  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
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
    sm: '4px',
    md: '7px',
    lg: '10px',
    xl: '12px',
    full: '9999px',
  },

  nav: { height: '54px' },

  shadow: {
    card: '0 12px 28px rgba(0,0,0,0.32)',
    glow: '0 0 18px rgba(89, 225, 198, 0.22)',
    active: '0 0 16px rgba(79, 210, 113, 0.25)',
  },

  maxWidth: '1440px',
} as const;

export type Theme = typeof theme;
export default theme;
