import type { ThemeConfig } from './types';

/**
 * Light theme. A pale new-leaf page with one green.
 *
 * Contrast is checked by src/themes/contrast.test.ts. Two rules the numbers force:
 * - Green as text uses accentText. The accent is a fill and mark colour: it falls to
 *   4.39:1 on the tinted surface.
 * - Marigold (--color-brand-marigold) is never a text colour on this page (1.94:1).
 */
const light: ThemeConfig = {
  name: 'light',
  displayName: 'Light',
  description: 'New-leaf page, white cards, one green',
  mode: 'light',
  colors: {
    bgPrimary: '#F2F7F0',
    bgSecondary: '#EBF1E9',
    // The selected or tinted surface.
    bgTertiary: '#E5EEE1',
    cardBg: '#FFFFFF',

    textPrimary: '#14241C',
    textNote: '#22332A',
    textSecondary: '#46544C',
    textTertiary: '#5A665F',
    noteWeight: '400',

    accent: '#357A45',
    accentHover: '#2D693B',
    accentGlow: 'rgba(53, 122, 69, 0.12)',
    accentMuted: 'rgba(53, 122, 69, 0.6)',
    accentText: '#2A6638',
    // Nothing is lighter than the white sheet, so a neutral glow cannot show here.
    // A faint leaf green does (DECISIONS.md, 2026-11-10).
    editorGlow: 'rgba(53, 122, 69, 0.08)',
    onAccent: '#FFFFFF',

    ctaBg: '#357A45',
    ctaBgHover: '#2D693B',
    ctaText: '#FFFFFF',

    destructive: '#B3261E',
    destructiveText: '#FFFFFF',
    // Green as text, so the link colour.
    success: '#2A6638',
    successGlow: 'rgba(53, 122, 69, 0.12)',
    error: '#B42318',
    errorLight: '#FBEAE8',

    statusProgress: '#2A6638',
    statusComing: '#8A5A12',
    statusExploring: '#5A665F',
    changeImprovement: '#2A6638',
    changeFix: '#5A665F',

    glassBorder: '#D9E4D4',
    inputBorder: '#7D8A82',
    // The white sheet already separates from the green page, so card shadows only
    // lift it a little. In the text's green-black.
    shadowSm: '0 1px 3px rgba(20, 36, 28, 0.05)',
    shadowMd: '0 1px 2px rgba(20, 36, 28, 0.04), 0 8px 20px -8px rgba(20, 36, 28, 0.08)',
    shadowLg: '0 2px 6px rgba(20, 36, 28, 0.05), 0 12px 32px -8px rgba(20, 36, 28, 0.12)',

    grainColor: 'black',
    noiseOpacity: '0.04',
  },
};

export default light;
