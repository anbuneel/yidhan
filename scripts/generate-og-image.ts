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
const OUTPUT_PATH = path.join(__dirname, '../public/og-image.png');

// ── Text content ────────────────────────────────────────────────
const TAGLINE = 'A quiet space for your mind';

/**
 * Build an SVG buffer for the tagline text below the lockup.
 */
function buildTaglineSvg(y: number): Buffer {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@300&amp;display=swap');
    </style>
  </defs>
  <text
    x="${WIDTH / 2}"
    y="${y}"
    text-anchor="middle"
    font-family="'Source Sans 3', 'Source Sans Pro', sans-serif"
    font-weight="300"
    font-size="26"
    letter-spacing="1"
    fill="${TEXT_MUTED}"
  >${TAGLINE}</text>
</svg>`.trim();

  return Buffer.from(svg);
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

  // ── Build the tagline SVG ──────────────────────────────────────
  const taglineY = LOCKUP_TOP + lockupH + 40;
  const taglineSvg = buildTaglineSvg(taglineY);

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
        input: taglineSvg,
        left: 0,
        top: 0,
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
