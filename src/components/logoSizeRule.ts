// The logo size rule: to 48px the small drawing; from 49px the full drawing. The mark
// carries no letter at any size (owner, 2026-11-11: the Tamil letter in the sun was one
// idea too many).

/** Largest size, in px, that uses the small drawing: two lines, long and short
 * (owner, 2026-11-11). The 16px favicon alone drops the lines. */
export const SMALL_MARK_MAX_PX = 48;

export type MarkDrawing = 'small' | 'full';

export function markDrawingFor(sizePx: number): MarkDrawing {
  return sizePx <= SMALL_MARK_MAX_PX ? 'small' : 'full';
}
