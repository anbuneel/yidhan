import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useMobileDetect } from '../hooks/useMobileDetect';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';
import { useModalFocusTrap } from '../hooks/useModalFocusTrap';
import { useGestureRuntime, type GestureRuntime } from '../utils/gestureRuntime';
import { ModalBackdropButton } from './ModalBackdropButton';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Title shown in the sheet header */
  title?: string;
  /** Maximum height as percentage of viewport (default: 90) */
  maxHeightPercent?: number;
  /** Whether to show the drag handle (default: true on mobile) */
  showHandle?: boolean;
  /** Additional class names for the content container */
  className?: string;
}

/** Reusable close button for modal headers */
function CloseButton({ onClick }: { onClick: () => void }): ReactNode {
  return (
    <button type="button"
      onClick={onClick}
      className="size-8 flex items-center justify-center rounded-full transition-colors duration-200 touch-press-light"
      style={{ color: 'var(--color-text-secondary)' }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--color-bg-tertiary)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
      aria-label="Close"
    >
      <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );
}

// Drag thresholds for dismiss gesture
// 100px is roughly the height of a navigation bar - feels natural as "intentional drag"
const DISMISS_THRESHOLD = 100;
// 0.5 velocity = fast swipe that should dismiss even with little distance
// This matches iOS behavior where a quick flick dismisses regardless of drag distance
const VELOCITY_THRESHOLD = 0.5;

interface MobileSheetMotionProps {
  runtime: GestureRuntime;
  isOpen: boolean;
  /** The sheet was already on screen (static) when the runtime arrived: start at rest. */
  startOpen: boolean;
  onClose: () => void;
  onExited: () => void;
  sheetRef: RefObject<HTMLElement | null>;
  backdropRef: RefObject<HTMLDivElement | null>;
  handleRef: RefObject<HTMLDivElement | null>;
  titleRef: RefObject<HTMLHeadingElement | null>;
}

/**
 * Spring and drag behaviour for the mobile sheet (A1c). Renders nothing: it writes the
 * sheet's transform and the backdrop's opacity straight to the DOM nodes the sheet
 * already rendered, so the sheet and its children never remount when the gesture chunk
 * arrives while the sheet is open. Must render after the sheet in the tree, so the
 * sheet's refs are attached before this component's layout effects run.
 */
function MobileSheetMotion({
  runtime,
  isOpen,
  startOpen,
  onClose,
  onExited,
  sheetRef,
  backdropRef,
  handleRef,
  titleRef,
}: MobileSheetMotionProps) {
  const { useDrag, useSpring, config, useSpringReducedMotion } = runtime;
  const reducedMotion = useSpringReducedMotion();

  const applyY = useCallback(
    (value: number) => {
      const sheet = sheetRef.current;
      if (!sheet) return;
      sheet.style.transform = value === 0 ? '' : `translate3d(0, ${value}px, 0)`;
    },
    [sheetRef]
  );

  const applyBackdropOpacity = useCallback(
    (value: number) => {
      const backdrop = backdropRef.current;
      if (!backdrop) return;
      backdrop.style.opacity = value === 1 ? '' : String(value);
    },
    [backdropRef]
  );

  // Spring for sheet position (0 = fully open, positive = dragging down)
  const [{ y }, api] = useSpring(() => ({
    y: startOpen ? 0 : window.innerHeight,
    config: config.stiff,
    onChange: ({ value }: { value: { y: number } }) => applyY(value.y),
  }));

  // Spring for backdrop opacity
  const [{ backdropOpacity }, backdropApi] = useSpring(() => ({
    backdropOpacity: startOpen ? 1 : 0,
    config: config.default,
    onChange: ({ value }: { value: { backdropOpacity: number } }) =>
      applyBackdropOpacity(value.backdropOpacity),
  }));

  // Open and close. A layout effect, so the starting position is written before the
  // first paint, and so it runs again whenever React re-attaches layout effects (for
  // example when a Suspense boundary above the sheet hides and reveals it), which puts
  // the sheet back on its target instead of leaving it wherever the spring was reset to.
  useLayoutEffect(() => {
    applyY(y.get());
    applyBackdropOpacity(backdropOpacity.get());

    if (isOpen) {
      api.start({ y: 0, immediate: reducedMotion });
      backdropApi.start({ backdropOpacity: 1, immediate: reducedMotion });
      return;
    }

    backdropApi.start({ backdropOpacity: 0, immediate: reducedMotion });
    if (reducedMotion) {
      api.start({ y: window.innerHeight, immediate: true });
      queueMicrotask(onExited);
      return;
    }
    api.start({
      y: window.innerHeight,
      onRest: (result: { finished?: boolean }) => {
        if (result.finished !== false) onExited();
      },
    });
  }, [isOpen, reducedMotion, api, backdropApi, y, backdropOpacity, applyY, applyBackdropOpacity, onExited]);

  // Drag to dismiss - bound to the handle and the title only, never the content.
  const handleDrag = ({
    movement: [, my],
    velocity: [, vy],
    down,
    cancel,
  }: {
    movement: [number, number];
    velocity: [number, number];
    down: boolean;
    cancel: () => void;
  }) => {
    // Only allow dragging down
    if (my < 0) {
      api.start({ y: 0, immediate: true });
      return;
    }

    if (down) {
      // While dragging, follow finger
      api.start({ y: my, immediate: true });
      return;
    }

    // On release, check if should dismiss
    const shouldDismiss = my > DISMISS_THRESHOLD || (vy > VELOCITY_THRESHOLD && my > 30);
    if (shouldDismiss) {
      api.start({
        y: window.innerHeight,
        immediate: reducedMotion,
        config: { ...config.stiff, velocity: vy },
      });
      backdropApi.start({ backdropOpacity: 0, immediate: reducedMotion });
      if (reducedMotion) {
        onClose();
      } else {
        // Wait for animation then close
        setTimeout(onClose, 200);
      }
      cancel();
    } else {
      // Snap back
      api.start({ y: 0, immediate: reducedMotion });
    }
  };

  const dragOptions = {
    from: () => [0, y.get()] as [number, number],
    filterTaps: true,
    bounds: { top: 0 },
    rubberband: true,
  };
  useDrag(handleDrag, { ...dragOptions, target: handleRef });
  useDrag(handleDrag, { ...dragOptions, target: titleRef });

  return null;
}

/**
 * iOS-style bottom sheet modal.
 *
 * On mobile: Slides up from bottom, drag handle to dismiss (gesture/spring runtime loaded lazily, A1c)
 * On desktop: Falls back to centered modal behavior without loading gesture libraries
 */
export function BottomSheet({
  isOpen,
  onClose,
  children,
  title,
  maxHeightPercent = 90,
  showHandle = true,
  className = '',
}: BottomSheetProps) {
  const isMobile = useMobileDetect();
  const keyboardHeight = useKeyboardHeight();
  const runtime = useGestureRuntime(isMobile && isOpen ? 'immediate' : 'passive');
  const [openedWithoutRuntime, setOpenedWithoutRuntime] = useState(() => isOpen && isMobile && !runtime);
  // Keeps the mobile sheet mounted while its close animation runs.
  const [isExiting, setIsExiting] = useState(false);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (prevIsOpen !== isOpen) {
    setPrevIsOpen(isOpen);
    setIsExiting(!isOpen && isMobile && runtime !== null);
  }
  const handleExited = useCallback(() => setIsExiting(false), []);

  const sheetRef = useRef<HTMLElement | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setOpenedWithoutRuntime(false);
    } else if (isMobile && !runtime) {
      setOpenedWithoutRuntime(true);
    }
  }, [isOpen, isMobile, runtime]);

  // The mobile sheet keeps one DOM node whether or not the gesture runtime has loaded,
  // so the node only changes when isMobile flips.
  useModalFocusTrap({
    isOpen,
    onClose,
    dialogRef: sheetRef,
    nodeKey: isMobile,
  });

  // Desktop fallback: centered modal (never loads react-spring or use-gesture)
  if (!isMobile) {
    if (!isOpen) return null;

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop"
      >
        <ModalBackdropButton label="Close sheet" onClick={onClose} />
        <dialog
          open
          ref={(el) => { sheetRef.current = el; }}
          tabIndex={-1}
          className={`
            relative z-10 w-full max-w-md mx-4 max-h-[85vh] overflow-hidden
            rounded-2xl shadow-[var(--shadow-lg)]
            p-0 border-0
            ${className}
          `}
          style={{
            background: 'var(--color-bg-primary)',
            animation: 'modal-enter 0.3s var(--ease-out-quint) forwards',
            margin: 0,
          }}
          aria-modal="true"
          aria-labelledby={title ? 'bottom-sheet-title' : undefined}
        >
          {/* Header with title and close button */}
          <div
            className="px-6 py-4 border-b flex items-center justify-between"
            style={{ borderColor: 'var(--glass-border)' }}
          >
            {/* Spacer for centering */}
            <div className="w-8" />
                {title && (
                  <h2
                    id="bottom-sheet-title"
                    className="text-lg font-medium text-center flex-1"
                style={{
                  fontFamily: 'var(--font-display)',
                  color: 'var(--color-text-primary)',
                }}
              >
                {title}
              </h2>
            )}
            <CloseButton onClick={onClose} />
          </div>
          <div className="overflow-y-auto max-h-[calc(85vh-60px)]">
            {children}
          </div>
        </dialog>
      </div>
    );
  }

  // Mobile: one sheet tree before and after the gesture chunk arrives (A1c). Until it
  // arrives the sheet is static and closes with its button, Escape or the backdrop.
  if (!isOpen && !isExiting) return null;

  const dragClass = runtime ? 'cursor-grab active:cursor-grabbing touch-none' : '';

  return (
    <>
      {/* Backdrop — keeps inline styles instead of .modal-backdrop per DESIGN.md */}
      <div
        ref={backdropRef}
        data-modal-backdrop="true"
        aria-hidden="true"
        className="fixed inset-0 z-50"
        style={{
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        ref={(el) => { sheetRef.current = el; }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'bottom-sheet-title' : undefined}
        tabIndex={-1}
        className={`
          fixed left-0 right-0 bottom-0 z-50
          rounded-t-3xl shadow-[var(--shadow-lg)] overflow-hidden
          ${className}
        `}
        style={{
          maxHeight: `${maxHeightPercent}vh`,
          background: 'var(--color-bg-primary)',
          // Safe area padding for iPhone home indicator
          paddingBottom: `calc(env(safe-area-inset-bottom) + ${keyboardHeight}px)`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle - ONLY this area and the title capture drag gestures */}
        {showHandle && (
          <div ref={handleRef} className={`flex justify-center pt-3 pb-2 ${dragClass}`}>
            <div
              className="w-10 h-1 rounded-full"
              style={{ background: 'var(--color-bg-tertiary)' }}
            />
          </div>
        )}

        {/* Header with title and close button */}
        <div
          className="px-6 pb-3 border-b flex items-center justify-between"
          style={{ borderColor: 'var(--glass-border)' }}
        >
          {/* Spacer for centering */}
          <div className="w-8" />
          {title && (
            <h2
              ref={titleRef}
              id="bottom-sheet-title"
              className={`text-lg font-medium text-center flex-1 ${dragClass}`}
              style={{
                fontFamily: 'var(--font-display)',
                color: 'var(--color-text-primary)',
              }}
            >
              {title}
            </h2>
          )}
          <CloseButton onClick={onClose} />
        </div>

        {/* Content - scrollable, NOT draggable */}
        <div
          className="overflow-y-auto touch-pan-y"
          style={{
            maxHeight: `calc(${maxHeightPercent}vh - ${title ? '80px' : '40px'} - env(safe-area-inset-bottom) - ${keyboardHeight}px)`,
          }}
        >
          {children}
        </div>
      </div>

      {/* After the sheet, so its refs are attached before the motion layout effects run. */}
      {runtime && (
        <MobileSheetMotion
          runtime={runtime}
          isOpen={isOpen}
          startOpen={openedWithoutRuntime}
          onClose={onClose}
          onExited={handleExited}
          sheetRef={sheetRef}
          backdropRef={backdropRef}
          handleRef={handleRef}
          titleRef={titleRef}
        />
      )}
    </>
  );
}
