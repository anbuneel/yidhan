/**
 * Generate the splash screens: Apple PWA launch images and the Android splash drawables.
 *
 * Each shows the bare leaf mark centred on the dark theme background. The mark is a
 * flat SVG from images/brand/export/ (python scripts/brand/flatten.py). At 128px and up
 * it carries the letter (owner, 2026-11-09); below that the sun is plain.
 *
 * Usage: npm run splash:generate
 */

import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXPORT_DIR = path.join(__dirname, '../images/brand/export');
const OUTPUT_DIR = path.join(__dirname, '../public/splash');
const ANDROID_RES = path.join(__dirname, '../android/app/src/main/res');

// Midnight theme background color (dark theme default). Matches capacitor.config.ts.
const BACKGROUND_COLOR = '#151C18';

// Logo size as percentage of the smaller dimension
const LOGO_SIZE_RATIO = 0.2;

/** The bare-mark letter rule: 128px and up. */
const LETTER_MIN_PX = 128;

async function renderMark(size: number): Promise<Buffer> {
  const file = size >= LETTER_MIN_PX ? 'mark-on-dark.svg' : 'mark-plain-on-dark.svg';
  const svg = fs
    .readFileSync(path.join(EXPORT_DIR, file), 'utf8')
    .replace('<svg ', `<svg width="${size}" height="${size}" `);
  return sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
}

async function renderSplash(width: number, height: number, outputPath: string) {
  const logoSize = Math.round(Math.min(width, height) * LOGO_SIZE_RATIO);
  await sharp({ create: { width, height, channels: 4, background: BACKGROUND_COLOR } })
    .composite([{ input: await renderMark(logoSize), gravity: 'center' }])
    .png({ compressionLevel: 9, palette: true, effort: 10 })
    .toFile(outputPath);
}

// Android splash drawables (Capacitor's SplashScreen plugin), by folder.
const ANDROID_SPLASHES: Array<[string, number, number]> = [
  ['drawable', 480, 320],
  ['drawable-land-mdpi', 480, 320],
  ['drawable-land-hdpi', 800, 480],
  ['drawable-land-xhdpi', 1280, 720],
  ['drawable-land-xxhdpi', 1600, 960],
  ['drawable-land-xxxhdpi', 1920, 1280],
  ['drawable-port-mdpi', 320, 480],
  ['drawable-port-hdpi', 480, 800],
  ['drawable-port-xhdpi', 720, 1280],
  ['drawable-port-xxhdpi', 960, 1600],
  ['drawable-port-xxxhdpi', 1280, 1920],
];

// Apple device splash screen sizes
// Format: { width, height, deviceWidth, deviceHeight, pixelRatio }
// Device dimensions are CSS pixels, actual sizes are multiplied by pixelRatio
const SPLASH_SIZES = [
  // iPhone SE (3rd gen), iPhone 8
  { width: 640, height: 1136, deviceWidth: 320, deviceHeight: 568, pixelRatio: 2, name: 'iPhone SE' },

  // iPhone 8 Plus
  { width: 1242, height: 2208, deviceWidth: 414, deviceHeight: 736, pixelRatio: 3, name: 'iPhone 8 Plus' },

  // iPhone X, XS, 11 Pro
  { width: 1125, height: 2436, deviceWidth: 375, deviceHeight: 812, pixelRatio: 3, name: 'iPhone X/XS/11 Pro' },

  // iPhone XR, 11
  { width: 828, height: 1792, deviceWidth: 414, deviceHeight: 896, pixelRatio: 2, name: 'iPhone XR/11' },

  // iPhone XS Max, 11 Pro Max
  { width: 1242, height: 2688, deviceWidth: 414, deviceHeight: 896, pixelRatio: 3, name: 'iPhone XS Max/11 Pro Max' },

  // iPhone 12 mini, 13 mini
  { width: 1080, height: 2340, deviceWidth: 360, deviceHeight: 780, pixelRatio: 3, name: 'iPhone 12/13 mini' },

  // iPhone 12, 12 Pro, 13, 13 Pro, 14
  { width: 1170, height: 2532, deviceWidth: 390, deviceHeight: 844, pixelRatio: 3, name: 'iPhone 12/13/14' },

  // iPhone 12 Pro Max, 13 Pro Max, 14 Plus
  { width: 1284, height: 2778, deviceWidth: 428, deviceHeight: 926, pixelRatio: 3, name: 'iPhone 12/13 Pro Max, 14 Plus' },

  // iPhone 14 Pro
  { width: 1179, height: 2556, deviceWidth: 393, deviceHeight: 852, pixelRatio: 3, name: 'iPhone 14 Pro' },

  // iPhone 14 Pro Max, 15 Plus, 15 Pro Max
  { width: 1290, height: 2796, deviceWidth: 430, deviceHeight: 932, pixelRatio: 3, name: 'iPhone 14/15 Pro Max' },

  // iPhone 15, 15 Pro
  { width: 1179, height: 2556, deviceWidth: 393, deviceHeight: 852, pixelRatio: 3, name: 'iPhone 15/15 Pro' },

  // iPad Mini 6
  { width: 1488, height: 2266, deviceWidth: 744, deviceHeight: 1133, pixelRatio: 2, name: 'iPad Mini 6' },

  // iPad (9th, 10th gen)
  { width: 1640, height: 2360, deviceWidth: 820, deviceHeight: 1180, pixelRatio: 2, name: 'iPad 10th gen' },

  // iPad Air (4th, 5th gen)
  { width: 1640, height: 2360, deviceWidth: 820, deviceHeight: 1180, pixelRatio: 2, name: 'iPad Air' },

  // iPad Pro 11"
  { width: 1668, height: 2388, deviceWidth: 834, deviceHeight: 1194, pixelRatio: 2, name: 'iPad Pro 11"' },

  // iPad Pro 12.9"
  { width: 2048, height: 2732, deviceWidth: 1024, deviceHeight: 1366, pixelRatio: 2, name: 'iPad Pro 12.9"' },
];

async function generateSplashScreens() {
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Track unique sizes to avoid duplicates
  const generated = new Set<string>();

  for (const config of SPLASH_SIZES) {
    const { width, height, name } = config;
    const filename = `splash-${width}x${height}.png`;
    if (generated.has(filename)) {
      console.log(`Skipping ${filename} (duplicate)`);
      continue;
    }
    generated.add(filename);
    await renderSplash(width, height, path.join(OUTPUT_DIR, filename));
    console.log(`Generated ${filename} (${width}x${height}) - ${name}`);
  }

  for (const [dir, width, height] of ANDROID_SPLASHES) {
    await renderSplash(width, height, path.join(ANDROID_RES, dir, 'splash.png'));
    console.log(`Generated android ${dir}/splash.png (${width}x${height})`);
  }

  console.log(`\n✅ Generated ${generated.size} splash screens in public/splash/`);

  // Output HTML snippet for index.html
  console.log('\n📋 Add these links to index.html (after apple-touch-icon):\n');

  const uniqueConfigs = SPLASH_SIZES.filter((config, index) => {
    const filename = `splash-${config.width}x${config.height}.png`;
    return SPLASH_SIZES.findIndex((c) => `splash-${c.width}x${c.height}.png` === filename) === index;
  });

  for (const config of uniqueConfigs) {
    const { width, height, deviceWidth, deviceHeight, pixelRatio } = config;
    const filename = `splash-${width}x${height}.png`;
    const orientation = height > width ? 'portrait' : 'landscape';

    console.log(
      `<link rel="apple-touch-startup-image" href="/splash/${filename}" media="(device-width: ${deviceWidth}px) and (device-height: ${deviceHeight}px) and (-webkit-device-pixel-ratio: ${pixelRatio}) and (orientation: ${orientation})">`
    );
  }
}

generateSplashScreens().catch((err) => {
  console.error('Error generating splash screens:', err);
  process.exit(1);
});
