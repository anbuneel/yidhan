/**
 * Yidhan Theme System
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

import kintsugi from './kintsugi';
import midnight from './midnight';
import washi from './washi';
import mori from './mori';
import type { ThemeConfig } from './types';

// ============================================
// ACTIVE THEME CONFIGURATION
// Change these to switch themes
// ============================================
export const ACTIVE_LIGHT_THEME = kintsugi;
export const ACTIVE_DARK_THEME = midnight;

// ============================================
// Theme Registry
// ============================================
const lightThemes: Record<string, ThemeConfig> = {
  kintsugi,
  washi,
};

const darkThemes: Record<string, ThemeConfig> = {
  midnight,
  mori,
};

export const allThemes: Record<string, ThemeConfig> = {
  ...lightThemes,
  ...darkThemes,
};

export { themeToCss, type ThemeConfig, type ThemeColors } from './types';
