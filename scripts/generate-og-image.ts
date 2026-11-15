/**
 * Generate the Open Graph image for Yidhan.
 *
 * The leaf lockup over the tagline in Newsreader, on a warm paper background. Both drawings are
 * flat SVGs from images/brand/export/ (python scripts/brand/flatten.py). The tagline is
 * outlined there, so no font is fetched or needed here.
 *
 * Usage: npm run og:generate
 */

import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Dimensions ──────────────────────────────────────────────────
const WIDTH = 1200;
const HEIGHT = 630;

// ── Brand tokens ────────────────────────────────────────────────
const BG_COLOR = '#F2F7F0'; // Light theme page (src/themes/light.ts)
const TEXT_MUTED = '#5A665F'; // Light theme muted text, for the tagline

// ── Layout ──────────────────────────────────────────────────────
const LOCKUP_HEIGHT = 200;
const TAGLINE_SIZE = 34; // Font size of the tagline, px
const GAP = 64; // Lockup bottom to tagline baseline

// ── Source / output paths ───────────────────────────────────────
const EXPORT_DIR = path.join(__dirname, '../images/brand/export');
const LOCKUP_PATH = path.join(EXPORT_DIR, 'lockup.svg');
const TAGLINE_PATH = path.join(EXPORT_DIR, 'og-tagline.svg');
const OUTPUT_PATH = path.join(__dirname, '../public/og-image.png');

/** viewBox numbers and the inner markup of a flat export SVG. */
function readSvg(file: string) {
  const text = fs.readFileSync(file, 'utf8');
  const vb = /viewBox="([^"]+)"/.exec(text)![1].split(' ').map(Number);
  const inner = text
    .replace(/^[\s\S]*?<\/title>/, '')
    .replace(/<\/svg>\s*$/, '')
    .trim();
  return { vb, inner };
}

async function generateOgImage() {
  for (const file of [LOCKUP_PATH, TAGLINE_PATH]) {
    if (!fs.existsSync(file)) {
      console.error(`Not found: ${file}. Run: python scripts/brand/flatten.py`);
      process.exit(1);
    }
  }

  const lockup = readSvg(LOCKUP_PATH);
  const tagline = readSvg(TAGLINE_PATH);

  // Lockup: scaled to LOCKUP_HEIGHT, centred.
  const [lx, ly, lw, lh] = lockup.vb;
  const lk = LOCKUP_HEIGHT / lh;
  const lockupW = lw * lk;

  // Tagline: font units to px. The viewBox is 0, -em, advance, 1.3 em.
  const [, emNeg, tw] = tagline.vb;
  const tk = TAGLINE_SIZE / -emNeg;
  const taglineW = tw * tk;

  const blockH = LOCKUP_HEIGHT + GAP + TAGLINE_SIZE * 0.3;
  const top = (HEIGHT - blockH) / 2;
  const baseline = top + LOCKUP_HEIGHT + GAP;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${BG_COLOR}"/>
  <g transform="translate(${(WIDTH - lockupW) / 2} ${top}) scale(${lk}) translate(${-lx} ${-ly})">${lockup.inner}</g>
  <g transform="translate(${(WIDTH - taglineW) / 2} ${baseline}) scale(${tk})" fill="${TEXT_MUTED}">${tagline.inner}</g>
</svg>`;

  await sharp(Buffer.from(svg)).png({ compressionLevel: 9, palette: true, effort: 10 }).toFile(OUTPUT_PATH);

  console.log(`Generated OG image: ${OUTPUT_PATH}`);
  console.log(`  ${WIDTH}x${HEIGHT}, lockup ${lockupW.toFixed(0)}x${LOCKUP_HEIGHT}, tagline ${taglineW.toFixed(0)}px wide`);
}

generateOgImage().catch((err) => {
  console.error('Error generating OG image:', err);
  process.exit(1);
});
