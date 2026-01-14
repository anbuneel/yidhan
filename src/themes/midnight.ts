import type { ThemeConfig } from './types';

/**
 * Midnight Dark Theme (Current Default Dark)
 *
 * Deep forest green with antique gold accents. Evokes writing
 * by candlelight in a wooden room.
 *
 * This is the ORIGINAL dark theme - kept as backup.
 */
export const midnight: ThemeConfig = {
  name: 'midnight',
  displayName: 'Midnight',
  description: 'Deep forest green with antique gold accents',
  mode: 'dark',
  colors: {
    // Background: Very deep, almost black green
    bgPrimary: '#050A06',
    bgSecondary: '#0A120B',
    bgTertiary: '#141E14',
    cardBg: 'rgba(20, 30, 20, 0.6)',

    // Typography: Warm off-white (secondary bumped ~12% brighter per Gemini feedback)
    textPrimary: '#EAE6D8',
    textSecondary: '#A3ABA3',
    textTertiary: '#5A615A',

    // Accent: Antique Gold / Firefly Light
    accent: '#D4AF37',
    accentHover: '#E5C44A',
    accentGlow: 'rgba(212, 175, 55, 0.15)',
    accentMuted: 'rgba(212, 175, 55, 0.6)',

    // Semantic
    destructive: '#EF4444',
    success: '#4CAF50',
    successGlow: 'rgba(76, 175, 80, 0.2)',
    error: '#EF4444',
    errorLight: 'rgba(239, 68, 68, 0.15)',

    // Status colors
    statusProgress: '#D4AF37',
    statusComing: '#E07A5F',
    statusExploring: '#9A9890',
    changeImprovement: '#87A878',
    changeFix: '#9A9890',

    // Borders and shadows (dark with gold tint)
    glassBorder: 'rgba(212, 175, 55, 0.15)',
    shadowSm: '0 2px 8px rgba(0, 0, 0, 0.3)',
    shadowMd: '0 10px 40px -10px rgba(0, 0, 0, 0.5)',
    shadowLg: '0 20px 50px -10px rgba(0, 0, 0, 0.6)',

    // Effects
    noiseOpacity: '0.10',
    noiseFilter: 'grayscale(100%)', // Neutral grain for dark mode
  },
};

export default midnight;
