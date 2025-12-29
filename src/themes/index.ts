/**
 * Zenote Theme System
 *
 * Centralized theme configuration for easy switching and backup.
 *
 * Usage:
 * - Import themes to reference colors in code
 * - Use themeToCss() to generate CSS variable declarations
 * - Active themes are set in index.css
 *
 * To switch themes:
 * 1. Update ACTIVE_LIGHT_THEME and ACTIVE_DARK_THEME below
 * 2. Run: npm run theme:generate (if build script exists)
 *    OR manually copy output of generateThemeCss() to index.css
 */

import { kintsugi } from './kintsugi';
import { midnight } from './midnight';
import { washi } from './washi';
import { mori } from './mori';
import { themeToCss, type ThemeConfig } from './types';

// ============================================
// ACTIVE THEME CONFIGURATION
// Change these to switch themes
// ============================================
export const ACTIVE_LIGHT_THEME = kintsugi;
export const ACTIVE_DARK_THEME = midnight;

// ============================================
// Theme Registry
// ============================================
export const lightThemes: Record<string, ThemeConfig> = {
  kintsugi,
  washi,
};

export const darkThemes: Record<string, ThemeConfig> = {
  midnight,
  mori,
};

export const allThemes: Record<string, ThemeConfig> = {
  ...lightThemes,
  ...darkThemes,
};

// ============================================
// Exports
// ============================================
export { kintsugi, midnight, washi, mori };
export { themeToCss, type ThemeConfig, type ThemeColors } from './types';

// ============================================
// Utility Functions
// ============================================

/**
 * Generate complete CSS for index.css
 * Copy this output to replace the theme sections in index.css
 */
export function generateThemeCss(
  lightTheme: ThemeConfig = ACTIVE_LIGHT_THEME,
  darkTheme: ThemeConfig = ACTIVE_DARK_THEME
): string {
  return `/* ============================================
 * Light Theme: ${lightTheme.displayName}
 * ${lightTheme.description}
 * ============================================ */
:root {
${themeToCss(lightTheme.colors)}
}

/* ============================================
 * Dark Theme: ${darkTheme.displayName}
 * ${darkTheme.description}
 * ============================================ */
[data-theme="dark"] {
${themeToCss(darkTheme.colors)}
}`;
}
