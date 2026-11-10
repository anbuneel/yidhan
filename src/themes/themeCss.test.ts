import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ACTIVE_DARK_THEME,
  ACTIVE_LIGHT_THEME,
  GRAIN_TILE_PX,
  THEME_BLOCK_PATTERN,
  generateThemeBlock,
  paperGrain,
  type ThemeColors,
} from '.';

// The theme values reach the page by three routes: the generated block in index.css,
// the landing shell's --b-* copies in index.html, and a handful of hand-copied hex
// values. Each case checks that a copy has not drifted, or that the grain has not
// crept back over content.

const root = resolve(__dirname, '../..');
// Line endings normalised, so a CRLF checkout on Windows compares the same as CI.
const read = (path: string) => readFileSync(resolve(root, path), 'utf8').replace(/\r\n/g, '\n');
const indexCss = read('src/index.css');
const indexHtml = read('index.html');
const light = ACTIVE_LIGHT_THEME.colors;
const dark = ACTIVE_DARK_THEME.colors;

/** The body of the first CSS rule whose selector is exactly `selector`. */
function rule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const body = new RegExp(`(^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(css)?.[2];
  if (body === undefined) throw new Error(`No rule for ${selector}`);
  return body;
}

describe('generated theme CSS', () => {
  it('equals what npm run theme:generate writes', () => {
    expect(indexCss.match(THEME_BLOCK_PATTERN)?.[0]).toBe(generateThemeBlock());
  });

  it('has exactly one generated block', () => {
    expect(indexCss.match(/THEME-START/g)).toHaveLength(1);
  });

  it('no longer carries the grain filter tints', () => {
    expect(indexCss).not.toMatch(/--noise-filter|--noise-opacity|sepia\(/);
    expect(Object.keys(light)).not.toContain('noiseFilter');
  });
});

describe('the grain is behind content, not over it', () => {
  it('has no fixed overlay on body', () => {
    expect(indexCss).not.toMatch(/body::(before|after)/);
    // No full-screen fixed layer anywhere paints the grain.
    for (const [, body] of indexCss.matchAll(/\{([^}]*)\}/g)) {
      if (/position:\s*fixed/.test(body)) expect(body).not.toMatch(/paper-grain|page-background|feTurbulence/);
    }
  });

  it('is untinted: one black or white ink, no colour channels', () => {
    for (const c of [light, dark]) {
      const url = decodeURIComponent(paperGrain(c.grainColor, c.noiseOpacity));
      const ink = c.grainColor === 'black' ? 0 : 1;
      expect(url).toContain(`values='0 0 0 0 ${ink} 0 0 0 0 ${ink} 0 0 0 0 ${ink} 0 0 0 1 0'`);
      expect(url).toContain(`opacity='${c.noiseOpacity}'`);
    }
    expect(light.grainColor).toBe('black');
    expect(dark.grainColor).toBe('white');
    expect(Number(light.noiseOpacity)).toBeCloseTo(0.07);
    expect(Number(dark.noiseOpacity)).toBeCloseTo(0.05);
  });

  it('sits on the page background only', () => {
    expect(indexCss).toContain(
      `--page-background: var(--paper-grain) 0 0 / ${GRAIN_TILE_PX}px ${GRAIN_TILE_PX}px repeat, var(--color-bg-primary);`,
    );
    expect(rule(indexCss, 'body')).toMatch(/background: var\(--page-background\);/);
    // Only the page variable reads the grain; no surface uses it directly.
    expect(indexCss.match(/var\(--paper-grain\)/g)).toHaveLength(1);
  });

  it('keeps cards, the editor sheet, modals, menus and inputs opaque and smooth', () => {
    for (const key of ['cardBg', 'bgPrimary', 'bgSecondary', 'bgTertiary'] as (keyof ThemeColors)[]) {
      expect(light[key], key).toMatch(/^#[0-9A-F]{6}$/i);
      expect(dark[key], key).toMatch(/^#[0-9A-F]{6}$/i);
    }
    expect(indexCss).toContain('--color-manuscript-bg: var(--color-card-bg);');
    // The editor sheet, a note card, and a modal panel.
    expect(rule(indexCss, '.editor-writing-area')).toMatch(/background: var\(--color-manuscript-bg\);/);
    expect(read('src/components/NoteCard.tsx')).not.toMatch(/page-background/);
    for (const file of ['ShareModal', 'TagModal', 'SettingsModal', 'ReAuthModal', 'KeyboardShortcutsModal']) {
      expect(read(`src/components/${file}.tsx`), file).not.toMatch(/page-background/);
    }
    expect(read('src/components/vaultScreenStyles.ts')).toMatch(/vaultInputStyle = \{\s*background: 'var\(--color-bg-primary\)'/);
  });
});

describe('landing shell mirror (index.html)', () => {
  const blocks = [...indexHtml.matchAll(/\{ (--b-bg:[^}]*)\}/g)].map((m) => m[1]);
  const vars = (block: string) =>
    Object.fromEntries([...block.matchAll(/(--b-[\w-]+): ([^;]+);/g)].map((m) => [m[1], m[2].trim()]));

  const expected = (c: ThemeColors) => ({
    '--b-bg': c.bgPrimary,
    '--b-bg2': c.bgSecondary,
    '--b-surface': c.cardBg,
    '--b-text': c.textPrimary,
    '--b-note': c.textNote,
    '--b-note-weight': c.noteWeight,
    '--b-text2': c.textSecondary,
    '--b-text3': c.textTertiary,
    '--b-accent': c.accent,
    '--b-cta-bg': c.ctaBg,
    '--b-cta-text': c.ctaText,
    '--b-border': c.glassBorder,
    '--b-glow': c.accentGlow,
    '--b-leaf': c.accent,
    '--b-grain': paperGrain(c.grainColor, c.noiseOpacity),
  });

  it('has the dark default, the light media query and the light data-theme block', () => {
    expect(blocks).toHaveLength(3);
    expect(vars(blocks[0])).toMatchObject(expected(dark));
    expect(vars(blocks[1])).toMatchObject(expected(light));
    expect(vars(blocks[2])).toMatchObject(expected(light));
  });

  it('paints the grain on the shell page the same way the app paints it', () => {
    expect(indexHtml).toContain(`background: var(--b-grain) 0 0 / ${GRAIN_TILE_PX}px ${GRAIN_TILE_PX}px repeat, var(--b-bg);`);
    // The manuscript is smooth, as in the app.
    expect(indexHtml).toMatch(/\.boot-manuscript \{[^}]*background: var\(--b-surface\);/);
    expect(read('src/components/LandingPage.tsx')).toMatch(/\.landing-canvas \{[^}]*background: var\(--page-background\);/);
  });

  it('shades the sheet only in light, as the app does', () => {
    expect(vars(blocks[0])['--b-shadow']).toBe('none');
    expect(indexCss).toMatch(/\[data-theme="dark"\] \{\s*--shadow-manuscript: none;/);
    const appLight = /--shadow-manuscript: ([^;]+);/.exec(indexCss)![1].replace(/\s+/g, ' ');
    expect(vars(blocks[1])['--b-shadow']).toBe(appLight);
  });

  it('sets the sample title like the editor title, in its React twin too', () => {
    expect(indexHtml).toMatch(/\.boot-manuscript h2 \{ font-family: 'Newsreader Display', 'Newsreader', Georgia, serif; font-weight: 500;/);
    expect(read('src/components/LandingPage.tsx')).toMatch(/\.landing-manuscript-title \{\s*font-family: var\(--font-title\);\s*font-weight: 500;/);
  });

  it('sets the sample note text in the note colour and weight', () => {
    expect(indexHtml).toMatch(/\.boot-manuscript p \{[^}]*font-weight: var\(--b-note-weight\);[^}]*color: var\(--b-note\);/);
    expect(rule(indexCss, '.landing-manuscript-text')).toMatch(/font-weight: var\(--note-weight\);\s*color: var\(--color-text-note\);/);
    // The React rule must not set them again in the colour or weight it used before.
    expect(read('src/components/LandingPage.tsx')).not.toMatch(/\.landing-manuscript-text \{[^}]*(font-weight|color):/);
  });
});

describe('hand-copied colours', () => {
  it('use the dark page where a native shell paints before the app', () => {
    expect(indexHtml).toContain(`<meta name="theme-color" content="${dark.bgPrimary}" />`);
    const vite = read('vite.config.ts');
    expect(vite).toContain(`theme_color: '${dark.bgPrimary}'`);
    expect(vite).toContain(`background_color: '${dark.bgPrimary}'`);
    expect(read('capacitor.config.ts').match(new RegExp(`'${dark.bgPrimary}'`, 'g'))).toHaveLength(2);
    expect(read('scripts/generate-splash-screens.ts')).toContain(`BACKGROUND_COLOR = '${dark.bgPrimary}'`);
    expect(read('scripts/generate-og-image.ts')).toContain(`BG_COLOR = '${light.bgPrimary}'`);
  });

  it('give the error screen dark fallbacks from the dark theme', () => {
    const boundary = read('src/components/ErrorBoundary.tsx');
    for (const [token, value] of [
      ['color-bg-primary', dark.bgPrimary],
      ['color-text-primary', dark.textPrimary],
      ['color-cta-bg', dark.ctaBg],
      ['color-cta-text', dark.ctaText],
    ]) {
      expect(boundary).toContain(`var(--${token}, ${value})`);
    }
    // No old gold or Midnight values left.
    expect(boundary).not.toMatch(/#D4AF37|#1a1f1a|#16161F/i);
  });

  it('leave no old theme values in the files that copy them', () => {
    const old = /#1a1f1a|#D4AF37|#EBE8E4|#050A06|#BF5432|#B04A2C/i;
    for (const file of ['index.html', 'vite.config.ts', 'capacitor.config.ts', 'src/components/ErrorBoundary.tsx', 'src/types.ts', 'scripts/generate-splash-screens.ts', 'scripts/generate-og-image.ts', 'src/index.css']) {
      expect(read(file), file).not.toMatch(old);
    }
  });
});

describe('the editor sheet', () => {
  it('is the solid card colour in dark too, with no shadow', () => {
    expect(indexCss).toMatch(/\[data-theme="dark"\] \.editor-writing-area \{\s*box-shadow: none;\s*\}/);
    expect(indexCss).not.toMatch(/\.editor-writing-area \{[^}]*color-mix/);
  });

  it('takes its glow from the accent, not a copied old colour', () => {
    expect(rule(indexCss, '.editor-manuscript-glow')).toContain('var(--color-accent)');
    expect(indexCss).not.toMatch(/\.editor-manuscript-glow \{[^}]*rgba\(/);
  });
});
