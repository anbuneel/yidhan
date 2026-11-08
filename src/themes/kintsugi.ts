import type { ThemeConfig } from './types';

/**
 * Kintsugi Light Theme (Current Default Light)
 *
 * Inspired by the Japanese art of kintsugi - repairing broken pottery
 * with gold. Features warm paper backgrounds and terracotta accents.
 *
 * This is the ORIGINAL light theme - kept as backup.
 */
const kintsugi: ThemeConfig = {
  name: 'kintsugi',
  displayName: 'Kintsugi',
  description: 'Warm paper backgrounds with terracotta accents',
  mode: 'light',
  colors: {
    // Background: Warm aged paper tones
    bgPrimary: '#EBE8E4',
    bgSecondary: '#E5E2DD',
    bgTertiary: '#D9D5CF',
    cardBg: 'rgba(252, 248, 238, 0.92)',

    // Typography: Dark sepia, not harsh black
    textPrimary: '#3E3B36',
    textSecondary: '#55524C', // 6.37:1 on bgPrimary, 5.33:1 on bgTertiary (item 160)
    textTertiary: '#65625C', // 4.98:1 on bgPrimary, 4.70:1 on bgSecondary (item 160)

    // Accent: Terracotta / Lacquer Red
    // Darkened from #C25634 (3.68:1 as text) in item 160. Accent is link, label and
    // selected-pill text, so it must carry 4.5:1 on the paper backgrounds and on its
    // own glow: 6.06:1 on bgPrimary, 5.07:1 on bgTertiary, 4.84:1 on accentGlow.
    accent: '#8F3C21',
    accentHover: '#75311B',
    accentGlow: 'rgba(143, 60, 33, 0.15)',
    accentMuted: 'rgba(143, 60, 33, 0.7)',
    onAccent: '#fff', // 7.40:1 on #8F3C21

    // CTA button (darker terracotta for WCAG AA contrast with white text — 5.44:1)
    ctaBg: '#B04A2C',
    ctaBgHover: '#963F24',
    ctaText: '#fff',

    // Semantic
    destructive: '#B54A32',
    destructiveText: '#fff', // 7.09:1 on #B54A32
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
    glassBorder: 'rgba(62, 59, 54, 0.25)',
    shadowSm: '0 2px 8px rgba(120, 80, 60, 0.18)',
    shadowMd: '0 4px 12px rgba(120, 80, 60, 0.12), 0 20px 40px -10px rgba(120, 80, 60, 0.38)',
    shadowLg: '0 4px 12px rgba(120, 80, 60, 0.15), 0 10px 40px rgba(120, 80, 60, 0.38)',

    // Effects
    noiseOpacity: '0.055', // Lowered from 0.18 — heavy grain over content blurred small/low-contrast text
    noiseFilter: 'sepia(65%) saturate(140%) brightness(0.93)', // Warmer, more defined grain
  },
};

export default kintsugi;
