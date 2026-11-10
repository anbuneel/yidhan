#!/usr/bin/env npx tsx
/**
 * Theme CSS generator. Writes the Light and Dark themes from src/themes/ into the
 * THEME-START/THEME-END block of src/index.css.
 *
 * Usage:
 *   npm run theme:generate              # Update index.css
 *   npm run theme:generate -- --preview # Print the block without writing
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { generateThemeBlock, THEME_BLOCK_PATTERN } from '../src/themes';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const block = generateThemeBlock();

if (process.argv.includes('--preview')) {
  console.log(block);
  process.exit(0);
}

const indexCssPath = path.join(__dirname, '../src/index.css');
const indexCss = fs.readFileSync(indexCssPath, 'utf-8');

if (!THEME_BLOCK_PATTERN.test(indexCss)) {
  console.error('Could not find the /* THEME-START */ ... /* THEME-END */ block in src/index.css.');
  process.exit(1);
}

// A function, so `$` sequences in the CSS are never read as replacement patterns.
fs.writeFileSync(indexCssPath, indexCss.replace(THEME_BLOCK_PATTERN, () => block));
console.log('Updated src/index.css with the Light and Dark themes.');
