import type { ThemeConfig } from './types';

/**
 * Dark theme. A deep green-black page with the same green, lifted.
 *
 * The CTA keeps the flipped polarity from DECISIONS.md (2026-03-22): a light green
 * fill with dark text. Note text is a little heavier than in the light theme, because
 * light text on a dark page reads thinner. No shadows: they do not show on this page.
 * Contrast is checked by src/themes/contrast.test.ts.
 */
const dark: ThemeConfig = {
  name: 'dark',
  displayName: 'Dark',
  description: 'Green-black page, solid cards, light green',
  mode: 'dark',
  colors: {
    bgPrimary: '#151C18',
    bgSecondary: '#18211C',
    // The selected or tinted surface.
    bgTertiary: '#1F2C25',
    cardBg: '#1B2620',

    textPrimary: '#E6E3DC',
    textNote: '#D3D2CA',
    textSecondary: '#B9BFB8',
    textTertiary: '#9AA69F',
    noteWeight: '430',

    accent: '#86C5A0',
    accentHover: '#9AD0B0',
    accentGlow: 'rgba(134, 197, 160, 0.14)',
    accentMuted: 'rgba(134, 197, 160, 0.55)',
    accentText: '#9AD0B0',
    onAccent: '#13201A',

    ctaBg: '#86C5A0',
    ctaBgHover: '#9AD0B0',
    ctaText: '#13201A',

    destructive: '#E8877C',
    destructiveText: '#151C18',
    success: '#9AD0B0',
    successGlow: 'rgba(134, 197, 160, 0.14)',
    error: '#F09A8F',
    errorLight: '#3A2421',

    statusProgress: '#9AD0B0',
    statusComing: '#F2A21B',
    statusExploring: '#9AA69F',
    changeImprovement: '#9AD0B0',
    changeFix: '#9AA69F',

    glassBorder: '#2A362F',
    inputBorder: '#6F7F75',
    shadowSm: 'none',
    shadowMd: 'none',
    shadowLg: 'none',

    grainColor: 'white',
    noiseOpacity: '0.05',
  },
};

export default dark;
