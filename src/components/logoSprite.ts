// References into the logo sprite that index.html carries outside #root
// (scripts/brand/flatten.py writes it). Only ids and viewBoxes here, no path data, so
// the header logo adds almost nothing to the JS entry. logoRollout.test.ts checks these
// against the sprite and logoPaths.ts.

export const SPRITE_MARK_SMALL = '#yidhan-mark-small';
export const SPRITE_WORDMARK = '#yidhan-wordmark';
export const SMALL_MARK_VIEWBOX = '1.5 1.5 12.5 12.5';
export const WORDMARK_VIEWBOX = '2 -1476 6003 1954';
export const WORDMARK_ASPECT = '6003 / 1954';
