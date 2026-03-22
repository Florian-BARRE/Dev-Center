// Design system — OLED Dark Mode / Developer Tool
// Palette: Blue primary (#2F81F7), Purple accent (#8B5CF6), Orange CTA (#F97316)
// Typography: Inter (text) + JetBrains Mono (code)

export const theme = {
  colors: {
    // Backgrounds
    bg:              '#030712',   // OLED near-black
    surface:         '#0D1117',   // Cards and panels
    surfaceElevated: '#161B22',   // Inputs, hover states
    surfaceHover:    '#21262D',   // Hover target overlay

    // Borders
    border:          '#21262D',   // Default border
    borderSubtle:    '#161B22',   // Subtle separator
    borderAccent:    '#30363D',   // Interactive/focused border

    // Brand
    primary:         '#2F81F7',   // Blue primary actions
    primaryHover:    '#1F6FEB',
    accent:          '#8B5CF6',   // Purple — Telegram/agent distinction
    accentHover:     '#7C3AED',
    cta:             '#F97316',   // Orange CTA (was `accent`)
    ctaHover:        '#EA6C0A',

    // Semantic
    success:         '#3FB950',
    successBg:       '#0F2D1A',
    warning:         '#D29922',
    warningBg:       '#2D1F0A',
    danger:          '#F85149',
    dangerBg:        '#2D0F0F',
    info:            '#60A5FA',
    infoBg:          '#0E1E35',

    // Text
    text:            '#E6EDF3',   // Primary text
    textSecondary:   '#8B949E',   // Secondary text
    muted:           '#7D8590',   // Captions, placeholders
    link:            '#60A5FA',
    onPrimary:       '#FFFFFF',

    // Terminal
    terminalBg:      '#010409',
  },
  spacing: {
    xs:  '4px',
    sm:  '8px',
    md:  '16px',
    lg:  '24px',
    xl:  '40px',
    xxl: '64px',
  },
  font: {
    sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    mono: "'JetBrains Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
    size: {
      xs:   '11px',
      sm:   '12px',
      md:   '14px',
      lg:   '16px',
      xl:   '20px',
      xxl:  '24px',
      xxxl: '32px',
    },
    weight: {
      light:    300,
      normal:   400,
      medium:   500,
      semibold: 600,
      bold:     700,
    } as const,
  },
  radius: {
    sm:  '4px',
    md:  '8px',
    lg:  '12px',
    xl:  '16px',
    full: '9999px',
  },
  shadow: {
    sm:  '0 1px 2px rgba(0,0,0,0.4)',
    md:  '0 4px 12px rgba(0,0,0,0.5)',
    lg:  '0 8px 32px rgba(0,0,0,0.6)',
    glow: '0 0 20px rgba(47,129,247,0.25)',
  },
  sidebar: {
    width: '220px',
  },
  transition: {
    fast:   'all 0.15s ease',
    normal: 'all 0.2s ease',
  },
} as const;

export type Theme = typeof theme;
