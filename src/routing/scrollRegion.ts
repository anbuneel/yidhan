/**
 * The scrollable region of a route.
 *
 * The library and the faded view scroll an inner `overflow-y-auto` element, not the
 * document, so `window.scrollY` is always 0 and restoring it restores nothing. A view
 * that wants its offset remembered marks its scrolling element with
 * `data-scroll-region`; the router reads and writes that element and nothing else.
 */

export const SCROLL_REGION_ATTRIBUTE = 'data-scroll-region';

/** Spread onto the element that actually scrolls. */
export const scrollRegionProps = { [SCROLL_REGION_ATTRIBUTE]: '' } as const;

function findScrollRegion(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.querySelector<HTMLElement>(`[${SCROLL_REGION_ATTRIBUTE}]`);
}

export function readScrollOffset(): number {
  const region = findScrollRegion();
  return region ? region.scrollTop : 0;
}

/**
 * Apply an offset, reporting whether the region was tall enough to take it.
 *
 * A `false` means the content has not finished rendering — the caller retries rather
 * than settling for a clamped position, which is how "back" used to land near the top
 * of a long library instead of where the reader left it.
 */
export function applyScrollOffset(offset: number): boolean {
  const region = findScrollRegion();
  if (!region) return false;

  const maxOffset = region.scrollHeight - region.clientHeight;
  if (offset > 0 && maxOffset < offset) {
    region.scrollTop = maxOffset > 0 ? maxOffset : 0;
    return false;
  }

  region.scrollTop = offset;
  return true;
}
