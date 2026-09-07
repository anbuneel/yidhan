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

export type EditorMenuDirection = 'down' | 'up' | 'right';
type EditorMenuPlacement = 'above' | 'below' | 'left' | 'right';

export interface EditorMenuPosition {
  left: number;
  top: number;
  maxHeight: number;
  placement: EditorMenuPlacement;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

export function getEditorMenuPosition(
  anchor: Rectangle,
  menu: Pick<Rectangle, 'width' | 'height'>,
  viewport: { width: number; height: number },
  preferredDirection: EditorMenuDirection,
): EditorMenuPosition {
  const maxHeight = Math.max(0, viewport.height - (VIEWPORT_MARGIN * 2));
  const renderedWidth = Math.min(menu.width, Math.max(0, viewport.width - (VIEWPORT_MARGIN * 2)));
  const renderedHeight = Math.min(menu.height, maxHeight);
  let placement: EditorMenuPlacement;
  let idealLeft: number;
  let idealTop: number;

  if (preferredDirection === 'right') {
    const spaceRight = viewport.width - anchor.right - ANCHOR_GAP - VIEWPORT_MARGIN;
    const spaceLeft = anchor.left - ANCHOR_GAP - VIEWPORT_MARGIN;
    placement = spaceRight >= renderedWidth || spaceRight >= spaceLeft ? 'right' : 'left';
    idealLeft = placement === 'right'
      ? anchor.right + ANCHOR_GAP
      : anchor.left - ANCHOR_GAP - renderedWidth;
    idealTop = anchor.top;
  } else {
    const spaceBelow = viewport.height - anchor.bottom - ANCHOR_GAP - VIEWPORT_MARGIN;
    const spaceAbove = anchor.top - ANCHOR_GAP - VIEWPORT_MARGIN;
    const preferBelow = preferredDirection === 'down';
    const useBelow = preferBelow
      ? spaceBelow >= renderedHeight || spaceBelow >= spaceAbove
      : !(spaceAbove >= renderedHeight || spaceAbove >= spaceBelow);
    placement = useBelow ? 'below' : 'above';
    idealLeft = anchor.right - renderedWidth;
    idealTop = placement === 'below'
      ? anchor.bottom + ANCHOR_GAP
      : anchor.top - ANCHOR_GAP - renderedHeight;
  }

  return {
    left: clamp(idealLeft, VIEWPORT_MARGIN, viewport.width - renderedWidth - VIEWPORT_MARGIN),
    top: clamp(idealTop, VIEWPORT_MARGIN, viewport.height - renderedHeight - VIEWPORT_MARGIN),
    maxHeight,
    placement,
  };
}
