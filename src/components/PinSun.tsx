import { memo } from 'react';

interface PinSunProps {
  noteId: string;
  onTogglePin: (id: string, pinned: boolean) => void;
}

// The sun, 18px. Its centre sits 5px up and left of the card's top-left corner, the
// logo's proportion, so the corner and its 3px gap take only a small bite. Centred on
// the corner it lost a full quarter and read as a different shape. The bite is a hole,
// so the page shows through.
const SUN_PATH =
  'm0 9c0-4.97 4.03-9 9-9c4.97 0 9 4.03 9 9c0 .69-.08 1.36-.22 2h-1.78c-2.76 0-5 2.24-5 5v1.78c-.64.14-1.31.22-2 .22c-4.97 0-9-4.03-9-9z';

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
