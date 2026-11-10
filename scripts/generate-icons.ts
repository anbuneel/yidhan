/**
 * Render the app icons from the flat leaf drawings.
 *
 * Source: images/brand/export/*.svg, written by `python scripts/brand/flatten.py`.
 * Output: PNGs in images/brand/export/, copies where the app serves them (public/),
 * and the Android launcher icons.
 *
 * Size rule (owner, 2026-11-09): from 16 to 48px the one-line small drawing; the
 * letter இ shows on the icon tile from 192px. Below that the sun is plain.
 *
 * Usage: npm run icons:generate
 */

import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'images/brand/export');
const PUBLIC = path.join(ROOT, 'public');
const ANDROID_RES = path.join(ROOT, 'android/app/src/main/res');

/** The tile letter rule: 192px and up. */
const TILE_LETTER_MIN = 192;

/** Corner radius for icons the platform shows as they are (purpose "any"). */
const ROUND = 0.22;

type Job = {
  /** Flat SVG in images/brand/export/. */
  svg: string;
  size: number;
  /** Paths relative to the repo root. */
  out: string[];
  /** Round the tile's corners (the platform does not mask it). */
  round?: boolean;
  /** Clip to a circle (Android legacy round icon). */
  circle?: boolean;
};

const tile = (size: number) => (size >= TILE_LETTER_MIN ? 'tile-dark.svg' : 'tile-dark-plain.svg');

const JOBS: Job[] = [
  // Favicons: the small drawing on a rounded dark tile.
  { svg: 'tile-dark-small.svg', size: 16, out: ['images/brand/export/favicon-16.png', 'public/icons/icon-16.png'] },
  {
    svg: 'tile-dark-small.svg',
    size: 32,
    out: ['images/brand/export/favicon-32.png', 'public/icons/icon-32.png', 'public/favicon.png'],
  },
  { svg: 'tile-dark-small.svg', size: 48, out: ['images/brand/export/favicon-48.png', 'public/icons/icon-48.png'] },
  // Install icons. The OS rounds the Apple touch icon and masks the maskable one.
  { svg: tile(192), size: 192, round: true, out: ['images/brand/export/icon-192.png', 'public/icons/icon-192.png'] },
  { svg: tile(512), size: 512, round: true, out: ['images/brand/export/icon-512.png', 'public/icons/icon-512.png'] },
  { svg: tile(512), size: 512, out: ['images/brand/export/maskable-512.png', 'public/icons/maskable-512.png'] },
  {
    svg: tile(180),
    size: 180,
    out: [
      'images/brand/export/apple-touch-icon.png',
      'public/icons/apple-touch-icon.png',
      'public/apple-touch-icon.png',
    ],
  },
  { svg: 'android-foreground.svg', size: 432, out: ['images/brand/export/android-foreground-432.png'] },
];

// Android launcher icons, per density. Launcher icons are 48dp and the adaptive
// foreground is 108dp, of which the centre 72dp shows. The letter follows the tile
// rule on the size the tile is shown at.
const DENSITIES: Array<[string, number]> = [
  ['mdpi', 1],
  ['hdpi', 1.5],
  ['xhdpi', 2],
  ['xxhdpi', 3],
  ['xxxhdpi', 4],
];
for (const [name, k] of DENSITIES) {
  const icon = 48 * k;
  const fg = 108 * k;
  const dir = `android/app/src/main/res/mipmap-${name}`;
  JOBS.push(
    { svg: tile(icon), size: icon, round: true, out: [`${dir}/ic_launcher.png`] },
    { svg: tile(icon), size: icon, circle: true, out: [`${dir}/ic_launcher_round.png`] },
    {
      svg: icon >= TILE_LETTER_MIN ? 'android-foreground.svg' : 'android-foreground-plain.svg',
      size: fg,
      out: [`${dir}/ic_launcher_foreground.png`],
    },
  );
}

/** Set the render size, and round or clip the tile. */
function prepare(svg: string, job: Job): string {
  let s = svg.replace('<svg ', `<svg width="${job.size}" height="${job.size}" `);
  const vb = /viewBox="0 0 (\d+) \d+"/.exec(s);
  const grid = vb ? Number(vb[1]) : 120;
  if (job.round) {
    s = s.replace(`<rect width="${grid}" height="${grid}"`, `<rect width="${grid}" height="${grid}" rx="${grid * ROUND}"`);
  }
  if (job.circle) {
    s = s.replace(`<rect width="${grid}" height="${grid}"`, `<rect width="${grid}" height="${grid}" rx="${grid / 2}"`);
  }
  return s;
}

async function renderPng(svg: string, size: number): Promise<Buffer> {
  return sharp(Buffer.from(svg))
    .resize(size, size)
    .png({ compressionLevel: 9, palette: true, effort: 10 })
    .toBuffer();
}

async function generateIcons() {
  if (!fs.existsSync(path.join(SRC, 'tile-dark.svg'))) {
    console.error(`Flat drawings not found in ${SRC}. Run: python scripts/brand/flatten.py`);
    process.exit(1);
  }
  for (const job of JOBS) {
    const svg = prepare(fs.readFileSync(path.join(SRC, job.svg), 'utf8'), job);
    const png = await renderPng(svg, job.size);
    for (const out of job.out) {
      fs.mkdirSync(path.dirname(path.join(ROOT, out)), { recursive: true });
      fs.writeFileSync(path.join(ROOT, out), png);
    }
    console.log(`${job.svg} -> ${job.size}px (${(png.length / 1024).toFixed(1)} KB): ${job.out.join(', ')}`);
  }
  // The adaptive icon draws the dark tile colour behind the foreground.
  fs.writeFileSync(
    path.join(ANDROID_RES, 'values/ic_launcher_background.xml'),
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#163026</color>\n</resources>\n',
  );
  console.log(`\nDone. ${PUBLIC} and ${ANDROID_RES} updated.`);
}

generateIcons().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
