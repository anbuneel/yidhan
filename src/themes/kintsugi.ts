import type { ThemeConfig } from './types';

/**
 * Kintsugi Light Theme (Current Default Light)
 *
 * Inspired by the Japanese art of kintsugi - repairing broken pottery
 * with gold. Features warm paper backgrounds and terracotta accents.
 *
 * This is the ORIGINAL light theme - kept as backup.
 */
export const kintsugi: ThemeConfig = {
  name: 'kintsugi',
  displayName: 'Kintsugi',
  description: 'Warm paper backgrounds with terracotta accents',
  mode: 'light',
  colors: {
    // Background: Warm aged paper tones
    bgPrimary: '#EBE8E4',
    bgSecondary: '#E5E2DD',
    bgTertiary: '#D9D5CF',
    cardBg: 'rgba(253, 250, 242, 0.75)',

    // Typography: Dark sepia, not harsh black
    textPrimary: '#3E3B36',
    textSecondary: '#6B6862',
    textTertiary: '#8F8C86',

    // Accent: Terracotta / Lacquer Red
    accent: '#C25634',
    accentHover: '#A84828',
    accentGlow: 'rgba(194, 86, 52, 0.2)',
    accentMuted: 'rgba(194, 86, 52, 0.7)',

    // Semantic
    destructive: '#B54A32',
    success: '#3D7A4A',
    successGlow: 'rgba(61, 122, 74, 0.15)',
    error: '#DC2626',
    errorLight: '#FEE2E2',

    // Status colors
    statusProgress: '#D4AF37',
    statusComing: '#C25634',
    statusExploring: '#8B8178',
    changeImprovement: '#87A878',
    changeFix: '#8B8178',

    // Borders and shadows (warm terracotta-brown tones per Gemini feedback)
    glassBorder: 'rgba(62, 59, 54, 0.12)',
    shadowSm: '0 2px 8px rgba(120, 80, 60, 0.10)',
    shadowMd: '0 20px 40px -10px rgba(120, 80, 60, 0.18)',
    shadowLg: '0 10px 40px rgba(120, 80, 60, 0.22)',

    // Effects
    noiseOpacity: '0.10',
    noiseFilter: 'sepia(80%) saturate(120%) brightness(0.95)', // Warm paper tint
  },
};

export default kintsugi;
