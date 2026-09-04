/**
 * Generate theme-aware masks for the Yidhan brand mark
 *
 * The logo mark (images/yidhan-logo-mark-512.webp) is a hand-painted raster
 * with terracotta and gold baked into its pixels, so it could not follow the
 * theme accent — on Midnight it sat as a terracotta arc in an all-gold UI.
 *
 * This splits the mark into two alpha masks, the brushstroke arc and the gold
 * seed, which `.brand-mark` (index.css) fills with CSS colours at render time.
 *
 * Mask alpha = pixel alpha × ink density. Density is how far a pixel's
 * luminance sits from white paper, normalised per region, so the watercolour
 * texture survives the tint instead of collapsing into a flat silhouette.
 * GAMMA below 1 lifts the mid-tones a little so the arc reads solid at header
 * size (26–30px) while the brush texture still shows at larger sizes.
 *
 * Usage: npm run logo:masks
 */

import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Source / output paths ───────────────────────────────────────
const SOURCE_PATH = path.join(__dirname, '../images/yidhan-logo-mark-512.webp');
const OUTPUT_DIR = path.join(__dirname, '../src/assets/brand');
const ARC_OUTPUT = path.join(OUTPUT_DIR, 'yidhan-logo-mark-arc.webp');
const DOT_OUTPUT = path.join(OUTPUT_DIR, 'yidhan-logo-mark-dot.webp');

// ── Tuning ──────────────────────────────────────────────────────
/** The gold seed, in source pixels. Radius includes a margin around the paint. */
const SEED = { cx: 227, cy: 258.5, r: 44 };
/** Luminance treated as fully inked, taken from this percentile of each region. */
const INK_PERCENTILE = 0.02;
/** < 1 lifts mid-tones (more solid); 1 keeps the source's exact ink density. */
const GAMMA = 0.8;
const PAPER_LUMINANCE = 255;

type Region = 'arc' | 'seed';

interface SourcePixels {
  data: Buffer;
  width: number;
  height: number;
  channels: number;
}

function luminance(data: Buffer, offset: number): number {
  return 0.2126 * data[offset] + 0.7152 * data[offset + 1] + 0.0722 * data[offset + 2];
}

function regionOf(x: number, y: number): Region {
  const dx = x - SEED.cx;
  const dy = y - SEED.cy;
  return dx * dx + dy * dy <= SEED.r * SEED.r ? 'seed' : 'arc';
}

/** Luminance at INK_PERCENTILE among solid pixels of a region (the darkest paint). */
function inkLuminance(source: SourcePixels, region: Region): number {
  const { data, width, height, channels } = source;
  const values: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * channels;
      if (data[offset + 3] > 200 && regionOf(x, y) === region) {
        values.push(luminance(data, offset));
      }
    }
  }
  values.sort((a, b) => a - b);
  return values[Math.floor(values.length * INK_PERCENTILE)];
}

function buildMask(source: SourcePixels, region: Region): Buffer {
  const { data, width, height, channels } = source;
  const ink = inkLuminance(source, region);
  const mask = Buffer.alloc(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (regionOf(x, y) !== region) continue;
      const offset = (y * width + x) * channels;
      const alpha = data[offset + 3] / 255;
      const raw = (PAPER_LUMINANCE - luminance(data, offset)) / (PAPER_LUMINANCE - ink);
      const density = Math.pow(Math.min(1, Math.max(0, raw)), GAMMA);
      mask[y * width + x] = Math.round(255 * alpha * density);
    }
  }

  return mask;
}

/** White RGB + the mask as alpha: `mask-image` reads the alpha channel. */
async function writeMask(source: SourcePixels, region: Region, outputPath: string) {
  const { width, height } = source;
  const mask = buildMask(source, region);
  const rgba = Buffer.alloc(width * height * 4, 255);
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4 + 3] = mask[i];
  }

  await sharp(rgba, { raw: { width, height, channels: 4 } })
    .webp({ lossless: true })
    .toFile(outputPath);

  const bytes = fs.statSync(outputPath).size;
  console.log(`✓ ${path.basename(outputPath)} (${(bytes / 1024).toFixed(1)}KB)`);
}

async function generateLogoMasks() {
  console.log('🖌  Yidhan Logo Mask Generator\n');

  if (!fs.existsSync(SOURCE_PATH)) {
    console.error(`❌ Logo mark not found: ${SOURCE_PATH}`);
    process.exit(1);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const { data, info } = await sharp(SOURCE_PATH)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const source: SourcePixels = {
    data,
    width: info.width,
    height: info.height,
    channels: info.channels,
  };

  console.log(`Source: ${info.width}×${info.height}, gamma ${GAMMA}\n`);
  await writeMask(source, 'arc', ARC_OUTPUT);
  await writeMask(source, 'seed', DOT_OUTPUT);

  console.log('\n✨ Done. `.brand-mark` in src/index.css tints these at render time.');
}

generateLogoMasks().catch((error) => {
  console.error('❌ Error generating logo masks:', error);
  process.exit(1);
});
