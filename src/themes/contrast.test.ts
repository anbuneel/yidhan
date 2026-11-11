import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACTIVE_DARK_THEME, ACTIVE_LIGHT_THEME, allThemes, type ThemeColors } from '.';
import { blend, contrast, parseColor } from './contrast';
import { TAG_COLORS } from '../types';

// Contrast for every pair the themes promise. Most cases check where a colour must
// not be used: marigold as text on the light page, the accent as text, a translucent
// card. A ratio under 4.5:1 for text or 3:1 for a boundary fails.

const MARIGOLD = '#F2A21B';
const root = resolve(__dirname, '../..');
const indexCss = readFileSync(resolve(root, 'src/index.css'), 'utf8').replace(/\r\n/g, '\n');

const TEXT_TOKENS = [
  'textPrimary',
  'textNote',
  'textSecondary',
  'textTertiary',
  'accentText',
  'success',
  'error',
  'statusProgress',
  'statusComing',
  'statusExploring',
  'changeImprovement',
  'changeFix',
] as const satisfies readonly (keyof ThemeColors)[];

const SURFACES = ['bgPrimary', 'bgSecondary', 'bgTertiary', 'cardBg'] as const satisfies readonly (keyof ThemeColors)[];

/** The page where the grain is at its strongest: the grain ink at full strength. */
function grainedPage(c: ThemeColors): string {
  const ink = c.grainColor === 'black' ? '0, 0, 0' : '255, 255, 255';
  return blend(`rgba(${ink}, ${c.noiseOpacity})`, c.bgPrimary);
}

const themes = [
  ['Light', ACTIVE_LIGHT_THEME.colors],
  ['Dark', ACTIVE_DARK_THEME.colors],
] as const;

describe('theme registry', () => {
  it('has only Light and Dark, named for the stored values', () => {
    expect(Object.keys(allThemes)).toEqual(['light', 'dark']);
    expect(ACTIVE_LIGHT_THEME).toMatchObject({ name: 'light', displayName: 'Light', mode: 'light' });
    expect(ACTIVE_DARK_THEME).toMatchObject({ name: 'dark', displayName: 'Dark', mode: 'dark' });
  });

  it('keeps the proposed values from the themes plan', () => {
    expect(ACTIVE_LIGHT_THEME.colors).toMatchObject({
      bgPrimary: '#F2F7F0', cardBg: '#FFFFFF', bgTertiary: '#E5EEE1', textPrimary: '#14241C',
      textNote: '#22332A', textTertiary: '#5A665F', accent: '#357A45', onAccent: '#FFFFFF',
      accentText: '#2A6638', glassBorder: '#D9E4D4',
    });
    expect(ACTIVE_DARK_THEME.colors).toMatchObject({
      bgPrimary: '#151C18', cardBg: '#1B2620', bgTertiary: '#1F2C25', textPrimary: '#E6E3DC',
      textNote: '#D3D2CA', textTertiary: '#9AA69F', accent: '#8FC79A', onAccent: '#13201A',
      accentText: '#A0D2A6', glassBorder: '#2A362F',
    });
  });
});

describe.each(themes)('%s theme contrast', (_name, c) => {
  it('has opaque surfaces, so no ratio depends on what shows through', () => {
    for (const key of [...SURFACES, 'glassBorder', 'inputBorder', 'errorLight'] as const) {
      expect(parseColor(c[key])[3], key).toBe(1);
    }
  });

  it.each(TEXT_TOKENS)('%s reaches 4.5:1 on every surface and on the grained page', (token) => {
    for (const surface of SURFACES) {
      expect(contrast(c[token], c[surface]), `${token} on ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(c[token], grainedPage(c)), `${token} on grain`).toBeGreaterThanOrEqual(4.5);
  });

  it('reads text on the accent, CTA, destructive and error fills at 4.5:1', () => {
    expect(contrast(c.onAccent, c.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.onAccent, c.accentHover)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.ctaText, c.ctaBg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.ctaText, c.ctaBgHover)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.destructiveText, c.destructive)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.error, c.errorLight)).toBeGreaterThanOrEqual(4.5);
  });

  it('reads green text on the accent and success tints', () => {
    for (const surface of [c.bgPrimary, c.cardBg]) {
      expect(contrast(c.accentText, blend(c.accentGlow, surface))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.success, blend(c.successGlow, surface))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('gives input borders and the focus ring 3:1, which the hairline does not reach', () => {
    for (const surface of SURFACES) {
      expect(contrast(c.inputBorder, c[surface]), `inputBorder on ${surface}`).toBeGreaterThanOrEqual(3);
    }
    for (const surface of [c.bgPrimary, c.cardBg]) {
      expect(contrast(c.accent, surface), 'focus ring').toBeGreaterThanOrEqual(3);
    }
    // The hairline is for dividers. If it ever reached 3:1 it could stand in for the
    // input border, and this split would be pointless.
    expect(contrast(c.glassBorder, c.bgPrimary)).toBeLessThan(3);
  });
});

describe('marigold and the accent are not text colours where they fail', () => {
  const light = ACTIVE_LIGHT_THEME.colors;

  it('marigold fails as text on the light page, so no light text token is marigold', () => {
    expect(contrast(MARIGOLD, light.bgPrimary)).toBeLessThan(3);
    for (const token of TEXT_TOKENS) {
      expect(light[token].toUpperCase(), token).not.toBe(MARIGOLD);
    }
  });

  it('replaces the brand gold with marigold, and never uses it as a text colour', () => {
    expect(indexCss).toContain(`--color-brand-marigold: ${MARIGOLD};`);
    expect(indexCss).not.toContain('--color-brand-gold');
    const files = walk(resolve(root, 'src')).filter((f) => /\.(tsx?|css)$/.test(f) && !f.endsWith('.test.ts'));
    const textUse = /(^|[^-])color:\s*['"]?(var\(--color-brand-marigold\)|#F2A21B)/i;
    expect(files.filter((f) => textUse.test(readFileSync(f, 'utf8')))).toEqual([]);
  });

  it('keeps the light accent off text: it fails on the tinted surface, the link token does not', () => {
    expect(contrast(light.accent, light.bgTertiary)).toBeLessThan(4.5);
    expect(contrast(light.accentText, light.bgTertiary)).toBeGreaterThanOrEqual(4.5);
    expect(light.accentText).not.toBe(light.accent);
    expect(light.success).toBe(light.accentText);
  });

  it('does not set text styles in the accent colour', () => {
    // A style object that sets a font and the accent colour is styling text, not an
    // icon. Text in green takes --color-accent-text.
    const offenders: string[] = [];
    for (const file of walk(resolve(root, 'src')).filter((f) => f.endsWith('.tsx') && !f.includes('.test.'))) {
      for (const [obj] of readFileSync(file, 'utf8').matchAll(/style=\{\{[^}]*\}\}/g)) {
        if (/color: 'var\(--color-accent\)'/.test(obj) && /fontFamily|fontSize|textDecoration/.test(obj)) {
          offenders.push(file);
        }
      }
    }
    expect(offenders).toEqual([]);
    expect(readFileSync(resolve(root, 'src/components/Editor.tsx'), 'utf8').replace(/\r\n/g, '\n')).toContain(
      // The save pill is neutral text; its icon, not a colour, tells the states apart.
      "data-save-status={saveStatus}\n          className=\"shrink-0 text-sm italic px-2 py-1 rounded-full flex items-center gap-1.5\"\n          style={{\n            fontFamily: 'var(--font-body)',\n            color: 'var(--color-text-secondary)',",
    );
  });
});

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

describe('tag colours', () => {
  it('keep their stored keys', () => {
    expect(Object.keys(TAG_COLORS)).toEqual(['terracotta', 'gold', 'forest', 'stone', 'indigo', 'clay', 'sage', 'plum']);
  });

  it.each(Object.entries(TAG_COLORS))('%s shows at 3:1 on both pages, cards and tinted surfaces', (_key, value) => {
    for (const [, c] of themes) {
      for (const surface of SURFACES) {
        expect(contrast(value, c[surface]), surface).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('none is marigold, which fails on the light page', () => {
    expect(Object.values(TAG_COLORS).map((v) => v.toUpperCase())).not.toContain(MARIGOLD);
  });
});
