/**
 * Generate PWA icons from logo PNG
 *
 * Usage: npx tsx scripts/generate-icons.ts
 *
 * This script:
 * 1. Takes the full logo PNG (with text)
 * 2. Crops just the icon portion (arc + dot) for app icons
 * 3. Generates all required PWA icon sizes
 * 4. Creates favicon
 */

import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Source files (in design-assets folder, not included in build)
const FULL_LOGO = path.join(__dirname, '../design-assets/yidhan-logo-primary.png');
const OUTPUT_DIR = path.join(__dirname, '../public/icons');
const PUBLIC_DIR = path.join(__dirname, '../public');

// Icon sizes for PWA
const ICON_SIZES = [
  { name: 'icon-512.png', size: 512 },
  { name: 'icon-192.png', size: 192 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'icon-32.png', size: 32 },
  { name: 'icon-16.png', size: 16 },
];

async function generateIcons() {
  console.log('🎨 Yidhan Icon Generator\n');

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Check if source exists
  if (!fs.existsSync(FULL_LOGO)) {
    console.error(`❌ Source logo not found: ${FULL_LOGO}`);
    console.log('Please ensure yidhan-logo-primary.png is in the public folder.');
    process.exit(1);
  }

  // Get source image metadata
  const metadata = await sharp(FULL_LOGO).metadata();
  console.log(`📐 Source image: ${metadata.width}x${metadata.height}`);

  // The logo has the arc+dot in the upper portion of the image
  // Image is 2816x1536 (landscape), arc+dot is centered in top ~50%
  const width = metadata.width!;
  const height = metadata.height!;

  // Crop parameters: focus on arc + dot only (exclude text)
  // The text "Yidhan" starts around 55% down, we want to exclude it
  const cropHeight = Math.floor(height * 0.52); // Top 52% has just the icon
  const cropWidth = Math.floor(width * 0.4); // Center 40% width
  const cropSize = Math.min(cropWidth, cropHeight);
  const cropLeft = Math.floor((width - cropSize) / 2);
  const cropTop = Math.floor(height * 0.05); // Start 5% from top to include full arc

  console.log(`✂️  Cropping icon area: ${cropSize}x${cropSize}\n`);

  // Extract and process the icon portion
  const iconBuffer = await sharp(FULL_LOGO)
    .extract({
      left: cropLeft,
      top: cropTop,
      width: cropSize,
      height: cropSize,
    })
    .toBuffer();

  // Generate all icon sizes
  for (const { name, size } of ICON_SIZES) {
    const outputPath = path.join(OUTPUT_DIR, name);

    await sharp(iconBuffer)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 250, g: 246, b: 241, alpha: 1 }, // Warm paper background
      })
      .png()
      .toFile(outputPath);

    console.log(`✓ Generated ${name} (${size}x${size})`);
  }

  // Copy apple-touch-icon to public root (required by iOS)
  const appleTouchSrc = path.join(OUTPUT_DIR, 'apple-touch-icon.png');
  const appleTouchDst = path.join(PUBLIC_DIR, 'apple-touch-icon.png');
  fs.copyFileSync(appleTouchSrc, appleTouchDst);
  console.log('✓ Copied apple-touch-icon.png to public root');

  // Generate favicon (32x32)
  const faviconPath = path.join(PUBLIC_DIR, 'favicon.png');
  fs.copyFileSync(path.join(OUTPUT_DIR, 'icon-32.png'), faviconPath);
  console.log('✓ Generated favicon.png');

  console.log('\n✨ All icons generated successfully!');
  console.log('\nNext steps:');
  console.log('1. Review generated icons in public/icons/');
  console.log('2. Update index.html favicon link if needed');
  console.log('3. Verify PWA manifest in vite.config.ts');
}

generateIcons().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
