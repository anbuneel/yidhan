import type { ThemeConfig } from './types';

/**
 * Mori Dark Theme (森 - Deep Forest)
 *
 * Evolution of the Midnight theme with refined forest green
 * undertones. Like writing by moonlight on the forest floor.
 * Features aged kintsugi gold accents.
 *
 * This theme refines the current dark direction with more
 * intentional green undertones and a slightly warmer gold.
 */
export const mori: ThemeConfig = {
  name: 'mori',
  displayName: 'Mori',
  description: 'Deep forest at dusk with aged gold accents',
  mode: 'dark',
  colors: {
    // Background: Forest floor at dusk
    bgPrimary: '#181D18',
    bgSecondary: '#1F251F',
    bgTertiary: '#282F28',
    cardBg: 'rgba(24, 29, 24, 0.8)',

    // Typography: Moonlight on paper
    textPrimary: '#E6E3DC',
    textSecondary: '#9A9890',
    textTertiary: '#5E5E58',

    // Accent: Antique gold - aged kintsugi
    accent: '#C9A962',
    accentHover: '#D9B972',
    accentGlow: 'rgba(201, 169, 98, 0.2)',
    accentMuted: 'rgba(201, 169, 98, 0.6)',

    // Semantic
    destructive: '#D4715E',
    success: '#5A9E5F',
    successGlow: 'rgba(90, 158, 95, 0.2)',
    error: '#EF4444',
    errorLight: 'rgba(239, 68, 68, 0.15)',

    // Status colors
    statusProgress: '#C9A962',
    statusComing: '#D4715E',
    statusExploring: '#9A9890',
    changeImprovement: '#7FA87F',
    changeFix: '#9A9890',

    // Borders and shadows (forest shadow)
    glassBorder: 'rgba(201, 169, 98, 0.12)',
    shadowSm: '0 2px 8px rgba(0, 0, 0, 0.25)',
    shadowMd: '0 10px 40px -10px rgba(0, 0, 0, 0.45)',
    shadowLg: '0 20px 50px -10px rgba(0, 0, 0, 0.55)',

    // Effects
    noiseOpacity: '0.10',
    noiseFilter: 'grayscale(100%)', // Neutral grain for dark mode
  },
};

export default mori;
