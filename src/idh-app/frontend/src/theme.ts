export const theme = {
  colors: {
    bg: '#0d1117',
    surface: '#161b22',
    surfaceHover: '#1c2128',
    border: '#30363d',
    primary: '#238636',
    primaryHover: '#2ea043',
    warning: '#d29922',
    danger: '#da3633',
    text: '#c9d1d9',
    muted: '#8b949e',
    link: '#58a6ff',
    onPrimary: '#ffffff',
    terminalBg: '#010409',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '40px',
  },
  font: {
    mono: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
    size: {
      xs: '11px',
      sm: '12px',
      md: '14px',
      lg: '16px',
      xl: '20px',
      xxl: '24px',
    },
    weight: {
      normal: 400,
      semibold: 600,
      bold: 700,
    } as const,
  },
  radius: {
    sm: '4px',
    md: '6px',
    lg: '8px',
  },
} as const;

export type Theme = typeof theme;
