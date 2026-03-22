// Design system — NEXUS dark command center aesthetic
// Palette: Electric Cyan primary (#3ddcff), Purple accent (#a78bfa)
// Typography: Syne (display) + Figtree (body) + JetBrains Mono (code/data)

export const theme = {
  colors: {
    // Backgrounds
    bg:              '#060610',   // near-black with blue tint
    surface:         '#0d0d1a',   // cards and panels
    surfaceElevated: '#14142a',   // elevated panels / modals
    surfaceHover:    '#1a1a32',   // hover target overlay

    // Borders
    border:          '#1e1e3a',   // default border
    borderSubtle:    '#14142a',   // subtle separator (kept for backward compat)
    borderAccent:    '#2d2d55',   // interactive / focused border

    // Brand — electric cyan
    primary:         '#3ddcff',   // alias for accent (used by existing components)
    primaryHover:    '#1fbfe0',
    primaryDim:      '#0a3a4a',   // background behind accent elements
    accent:          '#3ddcff',   // electric cyan — PRIMARY signature
    accentDim:       '#0a3a4a',   // background behind accent elements
    accentGlow:      'rgba(61,220,255,0.12)',

    // Secondary accent — purple
    purple:          '#a78bfa',
    purpleDim:       '#2d1f5e',

    // Semantic
    success:         '#22ddaa',
    successBg:       '#081f18',
    warning:         '#ffb340',
    warningBg:       '#1f1500',
    danger:          '#ff4070',
    dangerBg:        '#1f0012',

    // Text
    text:            '#e0e0f5',   // primary text
    textSecondary:   '#8888aa',   // secondary text
    muted:           '#555570',   // captions, placeholders
    link:            '#3ddcff',
    onPrimary:       '#060610',   // text on cyan bg

    // Terminal
    terminalBg:      '#02020a',
  },
  spacing: {
    xs:   '4px',
    sm:   '8px',
    md:   '12px',
    lg:   '16px',
    xl:   '24px',
    xxl:  '32px',
    xxxl: '48px',
  },
  font: {
    sans:    "'Figtree', sans-serif",
    display: "'Syne', sans-serif",
    mono:    "'JetBrains Mono', monospace",
    size: {
      xs:      '11px',
      sm:      '12px',
      base:    '13px',
      md:      '14px',
      lg:      '16px',
      xl:      '20px',
      xxl:     '28px',
      display: '36px',
      // Legacy aliases kept so existing components don't break
      xxxl:    '32px',
    },
    weight: {
      normal:   400,
      medium:   500,
      semibold: 600,
      bold:     700,
      extrabold: 800,
    } as const,
  },
  radius: {
    sm:   '4px',
    md:   '6px',
    lg:   '10px',
    xl:   '16px',
    full: '9999px',
  },
  shadow: {
    card:   '0 4px 24px rgba(0,0,0,0.4)',
    accent: '0 0 0 1px #3ddcff, 0 0 16px rgba(61,220,255,0.15)',
    glow:   '0 0 20px rgba(61,220,255,0.2)',
    // Legacy aliases
    sm:     '0 1px 2px rgba(0,0,0,0.4)',
    md:     '0 4px 12px rgba(0,0,0,0.5)',
    lg:     '0 8px 32px rgba(0,0,0,0.6)',
  },
  sidebar: {
    width: '240px',
  },
  transition: {
    fast:   'all 0.15s ease',
    base:   'all 0.2s ease',
    // Legacy alias
    normal: 'all 0.2s ease',
  },
} as const;

export type Theme = typeof theme;
