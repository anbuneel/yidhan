/**
 * Theme Configuration Types
 *
 * Defines the structure for Zenote color themes.
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

  // Accent colors
  accent: string;
  accentHover: string;
  accentGlow: string;
  accentMuted: string;

  // Semantic colors
  destructive: string;
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
  glassBorder: string;
  shadowSm: string;
  shadowMd: string;
  shadowLg: string;

  // Effects
  noiseOpacity: string;
  noiseFilter: string;
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
export function themeToCssVariables(theme: ThemeColors): Record<string, string> {
  return {
    '--color-bg-primary': theme.bgPrimary,
    '--color-bg-secondary': theme.bgSecondary,
    '--color-bg-tertiary': theme.bgTertiary,
    '--color-card-bg': theme.cardBg,
    '--color-text-primary': theme.textPrimary,
    '--color-text-secondary': theme.textSecondary,
    '--color-text-tertiary': theme.textTertiary,
    '--color-accent': theme.accent,
    '--color-accent-hover': theme.accentHover,
    '--color-accent-glow': theme.accentGlow,
    '--color-accent-muted': theme.accentMuted,
    '--color-destructive': theme.destructive,
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
    '--shadow-sm': theme.shadowSm,
    '--shadow-md': theme.shadowMd,
    '--shadow-lg': theme.shadowLg,
    '--noise-opacity': theme.noiseOpacity,
    '--noise-filter': theme.noiseFilter,
  };
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
