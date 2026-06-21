import type { ThemeConfig } from './types';

/**
 * Midnight Dark Theme (Current Default Dark)
 *
 * Deep forest green with antique gold accents. Evokes writing
 * by candlelight in a wooden room.
 *
 * This is the ORIGINAL dark theme - kept as backup.
 */
const midnight: ThemeConfig = {
  name: 'midnight',
  displayName: 'Midnight',
  description: 'Deep forest green with antique gold accents',
  mode: 'dark',
  colors: {
    // Background: Very deep, almost black green
    bgPrimary: '#050A06',
    bgSecondary: '#0A120B',
    bgTertiary: '#141E14',
    cardBg: 'rgba(20, 30, 20, 0.88)',

    // Typography: Warm off-white (secondary bumped ~12% brighter per Gemini feedback)
    textPrimary: '#EAE6D8',
    textSecondary: '#A3ABA3',
    textTertiary: '#8E9A8E',

    // Accent: Antique Gold / Firefly Light
    accent: '#D4AF37',
    accentHover: '#E5C44A',
    accentGlow: 'rgba(212, 175, 55, 0.15)',
    accentMuted: 'rgba(212, 175, 55, 0.6)',
    onAccent: '#16161F', // 8.55:1

    // CTA button (bright gold + dark text — 8.55:1, exceeds AAA)
    ctaBg: '#D4AF37',
    ctaBgHover: '#E5C44A',
    ctaText: '#16161F',

    // Semantic
    destructive: '#EF4444',
    destructiveText: '#050A06', // 5.30:1 on #EF4444
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
    glassBorder: 'rgba(212, 175, 55, 0.25)',
    shadowSm: '0 2px 8px rgba(5, 20, 10, 0.4)',
    shadowMd: '0 4px 12px rgba(5, 20, 10, 0.2), 0 10px 40px -10px rgba(5, 20, 10, 0.55)',
    shadowLg: '0 4px 12px rgba(5, 20, 10, 0.25), 0 20px 50px -10px rgba(5, 20, 10, 0.65)',

    // Effects
    noiseOpacity: '0.05',
    noiseFilter: 'grayscale(100%)', // Neutral grain for dark mode
  },
};

export default midnight;
