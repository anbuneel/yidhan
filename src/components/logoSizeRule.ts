// The logo size rule (owner, 2026-11-09): to 48px the small drawing; from 49px
// the full drawing; from 128px the letter இ in the sun. The icon tile has its own
// threshold, 192px, in scripts/generate-icons.ts.

/** Largest size, in px, that uses the small drawing: two lines, long and short
 * (owner, 2026-11-11). The 16px favicon alone drops the lines. */
export const SMALL_MARK_MAX_PX = 48;
/** Smallest size, in px, at which the bare mark carries the letter. */
export const LETTER_MIN_PX = 128;

export type MarkDrawing = 'small' | 'plain' | 'letter';

export function markDrawingFor(sizePx: number): MarkDrawing {
  if (sizePx <= SMALL_MARK_MAX_PX) return 'small';
  if (sizePx < LETTER_MIN_PX) return 'plain';
  return 'letter';
}
