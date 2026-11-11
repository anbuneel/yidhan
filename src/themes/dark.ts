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
    cardBg: '#1D2922',

    textPrimary: '#E6E3DC',
    textNote: '#D3D2CA',
    textSecondary: '#B9BFB8',
    textTertiary: '#9AA69F',
    noteWeight: '430',

    accent: '#8FC79A',
    accentHover: '#A0D2A6',
    accentGlow: 'rgba(143, 199, 154, 0.14)',
    accentMuted: 'rgba(143, 199, 154, 0.55)',
    accentText: '#A0D2A6',
    // The text colour at 4%: it lifts the dark sheet. Neutral, no accent.
    editorGlow: 'rgba(230, 227, 220, 0.04)',
    onAccent: '#13201A',

    ctaBg: '#8FC79A',
    ctaBgHover: '#A0D2A6',
    ctaText: '#13201A',

    destructive: '#E8877C',
    destructiveText: '#151C18',
    success: '#A0D2A6',
    successGlow: 'rgba(143, 199, 154, 0.14)',
    error: '#F09A8F',
    errorLight: '#3A2421',

    statusProgress: '#A0D2A6',
    statusComing: '#F2A21B',
    statusExploring: '#9AA69F',
    changeImprovement: '#A0D2A6',
    changeFix: '#9AA69F',

    glassBorder: '#33423A',
    inputBorder: '#6F7F75',
    shadowSm: 'none',
    shadowMd: 'none',
    shadowLg: 'none',

    grainColor: 'white',
    noiseOpacity: '0.05',
  },
};

export default dark;
