import { memo } from 'react';

interface PinSunProps {
  noteId: string;
  onTogglePin: (id: string, pinned: boolean) => void;
}

// The sun, 18px, centred on the card's top-left corner, with the corner and a 3px gap
// cut out of it. The cut is a hole, so the page shows through, as in the logo.
const SUN_PATH =
  'm0 9c0-4.97 4.03-9 9-9c3.92 0 7.25 2.5 8.49 6h-6.49c-2.76 0-5 2.24-5 5v6.49c-3.5-1.24-6-4.57-6-8.49z';

/**
 * The mark of a pinned note: the logo's marigold sun behind the card's top-left corner.
 * It is also the unpin button. Marigold's one job in the product (DESIGN.md).
 *
 * Drawn by the card's wrapper, not the card: the card and the swipe wrapper both clip
 * their overflow. The wrapper must be `position: relative`.
 */
export const PinSun = memo(function PinSun({ noteId, onTogglePin }: PinSunProps) {
  return (
    <button
      type="button"
      className="pin-sun"
      aria-label="Unpin note"
      title="Unpin note"
      onClick={(e) => {
        e.stopPropagation();
        onTogglePin(noteId, false);
      }}
    >
      <svg viewBox="0 0 18 18" aria-hidden="true" focusable="false">
        <path d={SUN_PATH} />
      </svg>
    </button>
  );
});
