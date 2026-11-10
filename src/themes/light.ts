import type { ThemeConfig } from './types';

/**
 * Light theme. A calm off-white page with one green.
 *
 * Contrast is checked by src/themes/contrast.test.ts. Two rules the numbers force:
 * - Green as text uses accentText. The accent is a fill and mark colour: it falls to
 *   4.39:1 on the tinted surface.
 * - Marigold (--color-brand-marigold) is never a text colour on this page (2.02:1).
 */
const light: ThemeConfig = {
  name: 'light',
  displayName: 'Light',
  description: 'Off-white page, white cards, one green',
  mode: 'light',
  colors: {
    bgPrimary: '#FAFAF6',
    bgSecondary: '#F3F4EF',
    // The selected or tinted surface.
    bgTertiary: '#EDF1EA',
    cardBg: '#FFFFFF',

    textPrimary: '#14241C',
    textNote: '#22332A',
    textSecondary: '#46544C',
    textTertiary: '#5A665F',
    noteWeight: '400',

    accent: '#2E7D55',
    accentHover: '#276B49',
    accentGlow: 'rgba(46, 125, 85, 0.12)',
    accentMuted: 'rgba(46, 125, 85, 0.6)',
    accentText: '#1F6A49',
    onAccent: '#FFFFFF',

    ctaBg: '#2E7D55',
    ctaBgHover: '#276B49',
    ctaText: '#FFFFFF',

    destructive: '#B3261E',
    destructiveText: '#FFFFFF',
    // Green as text, so the link colour.
    success: '#1F6A49',
    successGlow: 'rgba(46, 125, 85, 0.12)',
    error: '#B42318',
    errorLight: '#FBEAE8',

    statusProgress: '#1F6A49',
    statusComing: '#8A5A12',
    statusExploring: '#5A665F',
    changeImprovement: '#1F6A49',
    changeFix: '#5A665F',

    glassBorder: '#E1E4DC',
    inputBorder: '#7D8A82',
    // About half the old opacity, in the text's green-black instead of brown.
    shadowSm: '0 2px 8px rgba(20, 36, 28, 0.09)',
    shadowMd: '0 4px 12px rgba(20, 36, 28, 0.06), 0 20px 40px -10px rgba(20, 36, 28, 0.19)',
    shadowLg: '0 4px 12px rgba(20, 36, 28, 0.075), 0 10px 40px rgba(20, 36, 28, 0.19)',

    grainColor: 'black',
    noiseOpacity: '0.07',
  },
};

export default light;
