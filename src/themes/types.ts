/**
 * Theme Configuration Types
 *
 * Defines the structure for Yidhan color themes.
 * All colors use CSS-compatible values (hex, rgba, etc.)
 */

export interface ThemeColors {
  // Background colors
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  cardBg: string;

  // Text colors
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  /** Running note text: the editor body and card previews. */
  textNote: string;
  /** Font weight of note text. Light text on a dark page needs a little more. */
  noteWeight: string;

  // Accent colors
  accent: string;
  accentHover: string;
  accentGlow: string;
  accentMuted: string;
  onAccent: string; // Contrast-safe text color for accent surfaces (non-CTA)
  /** Accent as text: links and selected labels. 4.5:1 on the page, card and glow backgrounds. */
  accentText: string;

  // CTA button (separate from accent for accessibility)
  ctaBg: string;
  ctaBgHover: string;
  ctaText: string;

  // Semantic colors
  destructive: string;
  destructiveText: string; // Contrast-safe text color for destructive surfaces
  success: string;
  successGlow: string;
  error: string;
  errorLight: string;

  // Status colors (roadmap/changelog)
  statusProgress: string;
  statusComing: string;
  statusExploring: string;
  changeImprovement: string;
  changeFix: string;

  // Borders and shadows
  /** Hairline for dividers and card outlines. Below 3:1, so not for inputs. */
  glassBorder: string;
  /** Input borders: 3:1 or better on the page, card and tinted surface. */
  inputBorder: string;
  shadowSm: string;
  shadowMd: string;
  shadowLg: string;

  // Paper grain on the page background only (see --page-background in index.css)
  /** Grain ink: black specks on a light page, white on a dark one. Never tinted. */
  grainColor: 'black' | 'white';
  /** Grain strength, 0 to 1. */
  noiseOpacity: string;
}

export interface ThemeConfig {
  name: string;
  displayName: string;
  description: string;
  mode: 'light' | 'dark';
  colors: ThemeColors;
}

/**
 * Converts a ThemeConfig to CSS variable declarations
 */
function themeToCssVariables(theme: ThemeColors): Record<string, string> {
  return {
    '--color-bg-primary': theme.bgPrimary,
    '--color-bg-secondary': theme.bgSecondary,
    '--color-bg-tertiary': theme.bgTertiary,
    '--color-card-bg': theme.cardBg,
    '--color-text-primary': theme.textPrimary,
    '--color-text-secondary': theme.textSecondary,
    '--color-text-tertiary': theme.textTertiary,
    '--color-text-note': theme.textNote,
    '--note-weight': theme.noteWeight,
    '--color-accent': theme.accent,
    '--color-accent-hover': theme.accentHover,
    '--color-accent-glow': theme.accentGlow,
    '--color-accent-muted': theme.accentMuted,
    '--color-accent-text': theme.accentText,
    '--color-on-accent': theme.onAccent,
    '--color-cta-bg': theme.ctaBg,
    '--color-cta-bg-hover': theme.ctaBgHover,
    '--color-cta-text': theme.ctaText,
    '--color-destructive': theme.destructive,
    '--color-destructive-text': theme.destructiveText,
    '--color-success': theme.success,
    '--color-success-glow': theme.successGlow,
    '--color-error': theme.error,
    '--color-error-light': theme.errorLight,
    '--color-status-progress': theme.statusProgress,
    '--color-status-coming': theme.statusComing,
    '--color-status-exploring': theme.statusExploring,
    '--color-change-improvement': theme.changeImprovement,
    '--color-change-fix': theme.changeFix,
    '--glass-border': theme.glassBorder,
    '--color-input-border': theme.inputBorder,
    '--shadow-sm': theme.shadowSm,
    '--shadow-md': theme.shadowMd,
    '--shadow-lg': theme.shadowLg,
    '--paper-grain': paperGrain(theme.grainColor, theme.noiseOpacity),
  };
}

/** Side of one grain tile in CSS pixels. The SVG tiles seamlessly (stitchTiles). */
export const GRAIN_TILE_PX = 180;

/**
 * The page grain as a CSS url(): fractal noise whose alpha drives a single ink colour,
 * so the grain darkens (or lightens) the page without tinting it.
 */
export function paperGrain(color: 'black' | 'white', opacity: string): string {
  const ink = color === 'black' ? 0 : 1;
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${GRAIN_TILE_PX}' height='${GRAIN_TILE_PX}'>` +
    `<filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/>` +
    `<feColorMatrix values='0 0 0 0 ${ink} 0 0 0 0 ${ink} 0 0 0 0 ${ink} 0 0 0 1 0'/></filter>` +
    `<rect width='100%' height='100%' filter='url(#g)' opacity='${opacity}'/></svg>`;
  return `url("data:image/svg+xml,${svg.replace(/%/g, '%25').replace(/</g, '%3C').replace(/>/g, '%3E').replace(/#/g, '%23')}")`;
}

/**
 * Generates CSS text for a theme (for :root or [data-theme="dark"])
 */
export function themeToCss(theme: ThemeColors, indent: string = '  '): string {
  const vars = themeToCssVariables(theme);
  return Object.entries(vars)
    .map(([key, value]) => `${indent}${key}: ${value};`)
    .join('\n');
}
