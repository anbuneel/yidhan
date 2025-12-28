import type { ThemeConfig } from './types';

/**
 * Washi Light Theme (和紙 - Handmade Paper)
 *
 * Inspired by traditional Japanese handmade paper with visible
 * fibers and warm, uneven tones. Features kakishibu (persimmon
 * tannin) brown accents - a traditional Japanese dye.
 *
 * This theme addresses the "grey background" concern by using
 * warm cream tones that feel authentically wabi-sabi.
 */
export const washi: ThemeConfig = {
  name: 'washi',
  displayName: 'Washi',
  description: 'Warm handmade paper with persimmon tannin accents',
  mode: 'light',
  colors: {
    // Background: Aged washi paper - warm cream with yellow undertone
    bgPrimary: '#F6F1E7',
    bgSecondary: '#EDE6D6',
    bgTertiary: '#E3D9C6',
    cardBg: 'rgba(253, 250, 242, 0.75)',

    // Typography: Sumi ink - warm black
    textPrimary: '#3D3630',
    textSecondary: '#6B6358',
    textTertiary: '#8F8A82',

    // Accent: Kakishibu - persimmon tannin brown
    accent: '#8B4513',
    accentHover: '#A0522D',
    accentGlow: 'rgba(139, 69, 19, 0.2)',
    accentMuted: 'rgba(139, 69, 19, 0.7)',

    // Semantic
    destructive: '#9B3D2B',
    success: '#4A6741',
    successGlow: 'rgba(74, 103, 65, 0.15)',
    error: '#DC2626',
    errorLight: '#FEE2E2',

    // Status colors
    statusProgress: '#B8860B',
    statusComing: '#8B4513',
    statusExploring: '#8B8178',
    changeImprovement: '#6B8E6B',
    changeFix: '#8B8178',

    // Borders and shadows (warm sepia tones)
    glassBorder: 'rgba(61, 54, 48, 0.1)',
    shadowSm: '0 2px 8px rgba(61, 54, 48, 0.06)',
    shadowMd: '0 20px 40px -10px rgba(61, 54, 48, 0.12)',
    shadowLg: '0 10px 40px rgba(61, 54, 48, 0.15)',

    // Effects
    noiseOpacity: '0.10',
    noiseFilter: 'sepia(80%) saturate(120%) brightness(0.95)', // Warm aged paper tint
  },
};

export default washi;
