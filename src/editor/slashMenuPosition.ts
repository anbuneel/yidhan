const VIEWPORT_MARGIN = 8;
const ANCHOR_GAP = 8;

interface Rectangle {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}

export interface SlashMenuPosition {
  left: number;
  top: number;
  placement: 'above' | 'below';
  maxHeight: number;
}

export function getSlashMenuPosition(
  anchor: Rectangle,
  menu: Pick<Rectangle, 'width' | 'height'>,
  viewport: { width: number; height: number },
): SlashMenuPosition {
  const availableBelow = viewport.height - anchor.bottom - ANCHOR_GAP - VIEWPORT_MARGIN;
  const availableAbove = anchor.top - ANCHOR_GAP - VIEWPORT_MARGIN;
  const placement = availableBelow >= menu.height || availableBelow >= availableAbove ? 'below' : 'above';
  const maxHeight = Math.max(96, placement === 'below' ? availableBelow : availableAbove);
  const unclampedTop = placement === 'below'
    ? anchor.bottom + ANCHOR_GAP
    : anchor.top - ANCHOR_GAP - Math.min(menu.height, maxHeight);
  const maxLeft = Math.max(VIEWPORT_MARGIN, viewport.width - menu.width - VIEWPORT_MARGIN);
  const maxTop = Math.max(VIEWPORT_MARGIN, viewport.height - Math.min(menu.height, maxHeight) - VIEWPORT_MARGIN);

  return {
    left: Math.min(Math.max(anchor.left, VIEWPORT_MARGIN), maxLeft),
    top: Math.min(Math.max(unclampedTop, VIEWPORT_MARGIN), maxTop),
    placement,
    maxHeight,
  };
}
