/**
 * Generate Open Graph image for Yidhan
 *
 * Composites the brand lockup (mark + gold-foil wordmark) onto a warm paper
 * background with the tagline below. Uses the pre-designed lockup asset so the
 * OG image matches the actual brand identity.
 *
 * Usage: npx tsx scripts/generate-og-image.ts
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
const BG_COLOR = '#f5f0e8'; // Warm paper tone (Kintsugi light bg)
const TEXT_MUTED = '#7a7068'; // Warm muted text for tagline

// ── Layout constants ────────────────────────────────────────────
const LOCKUP_HEIGHT = 360; // Height to fit the lockup within
const LOCKUP_TOP = 60; // Top padding above lockup

// ── Source / output paths ───────────────────────────────────────
const LOCKUP_PATH = path.join(__dirname, '../images/yidhan-logo-lockup-tight-1200.webp');
// Pango's fontfile loader needs an SFNT font, not the browser's WOFF2 wrapper.
// prepare-og-font.py pins weight 300 and gives the font a unique family so an
// installed Source Sans cannot override it. Licensed under the bundled OFL.
const FONT_PATH = path.join(__dirname, 'assets/fonts/yidhan-preview.ttf');
const OUTPUT_PATH = path.join(__dirname, '../public/og-image.png');

// ── Text content ────────────────────────────────────────────────
const TAGLINE = 'A quiet space for your mind';

/**
 * Render with the bundled font through Pango, rather than an SVG @import
 * that depends on the renderer's external-resource and installed-font support.
 * At 72 DPI, 26 points = 26 pixels; Pango letter spacing uses 1/1024 points.
 */
async function renderTagline() {
  if (!fs.existsSync(FONT_PATH)) {
    throw new Error(`Bundled tagline font not found: ${FONT_PATH}`);
  }

  return sharp({
    text: {
      text: `<span foreground="${TEXT_MUTED}" letter_spacing="1024">${TAGLINE}</span>`,
      font: 'Yidhan Preview 26',
      fontfile: FONT_PATH,
      dpi: 72,
      rgba: true,
    },
  }).png().toBuffer({ resolveWithObject: true });
}

async function generateOgImage() {
  console.log('🖼  Yidhan OG Image Generator\n');

  // ── Validate source lockup exists ──────────────────────────────
  if (!fs.existsSync(LOCKUP_PATH)) {
    console.error(`❌ Brand lockup not found: ${LOCKUP_PATH}`);
    process.exit(1);
  }

  // ── Prepare the lockup ────────────────────────────────────────
  const lockupMeta = await sharp(LOCKUP_PATH).metadata();
  const lockupAspect = (lockupMeta.width || 1) / (lockupMeta.height || 1);
  const lockupW = Math.round(LOCKUP_HEIGHT * lockupAspect);
  const lockupH = LOCKUP_HEIGHT;

  const lockupBuffer = await sharp(LOCKUP_PATH)
    .resize(lockupW, lockupH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const lockupLeft = Math.round((WIDTH - lockupW) / 2);

  // The text renderer returns a tight crop. Keep its visible top 20px below
  // the lockup, matching the previous SVG's 40px baseline offset.
  const tagline = await renderTagline();
  const taglineTop = LOCKUP_TOP + lockupH + 20;

  // ── Composite everything onto the warm paper background ────────
  await sharp({
    create: {
      width: WIDTH,
      height: HEIGHT,
      channels: 4,
      background: BG_COLOR,
    },
  })
    .composite([
      // Brand lockup (mark + wordmark)
      {
        input: lockupBuffer,
        left: lockupLeft,
        top: LOCKUP_TOP,
      },
      // Tagline
      {
        input: tagline.data,
        left: Math.round((WIDTH - tagline.info.width) / 2),
        top: taglineTop,
      },
    ])
    .png()
    .toFile(OUTPUT_PATH);

  console.log(`✓ Generated OG image: ${OUTPUT_PATH}`);
  console.log(`  Dimensions: ${WIDTH}×${HEIGHT}`);
  console.log(`  Background: ${BG_COLOR}`);
  console.log(`  Lockup:     ${lockupW}×${lockupH} (centered)`);
  console.log(`\n✨ Done! The image is referenced in index.html as /og-image.png`);
}

generateOgImage().catch((err) => {
  console.error('Error generating OG image:', err);
  process.exit(1);
});
