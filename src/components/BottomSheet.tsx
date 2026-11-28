import { useEffect, useRef, useState, type ReactNode, type MutableRefObject } from 'react';
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

interface MobileSpringBottomSheetProps {
  runtime: GestureRuntime;
  isOpen: boolean;
  wasAlreadyOpen: boolean;
  onClose: () => void;
  sheetRef: MutableRefObject<HTMLElement | null>;
  children: ReactNode;
  title?: string;
  maxHeightPercent: number;
  showHandle: boolean;
  className: string;
  keyboardHeight: number;
}

function MobileSpringBottomSheet({
  runtime,
  isOpen,
  wasAlreadyOpen,
  onClose,
  sheetRef,
  children,
  title,
  maxHeightPercent,
  showHandle,
  className,
  keyboardHeight,
}: MobileSpringBottomSheetProps) {
  const { useDrag, useSpring, animated, config, useSpringReducedMotion } = runtime;
  const reducedMotion = useSpringReducedMotion();

  // Track whether component should render (allows animation to complete before unmount)
  const [shouldRender, setShouldRender] = useState(isOpen);

  // Spring for sheet position (0 = fully open, positive = dragging down)
  const [{ y }, api] = useSpring(() => ({
    y: wasAlreadyOpen ? 0 : window.innerHeight,
    config: config.stiff,
  }));

  // Spring for backdrop opacity
  const [{ backdropOpacity }, backdropApi] = useSpring(() => ({
    backdropOpacity: wasAlreadyOpen ? 1 : 0,
    config: config.default,
  }));

  // Handle open/close animations
  // Using queueMicrotask to defer setState and avoid synchronous render cascade
  useEffect(() => {
    if (isOpen) {
      queueMicrotask(() => setShouldRender(true));
      api.start({ y: 0, immediate: reducedMotion });
      backdropApi.start({ backdropOpacity: 1, immediate: reducedMotion });
    } else {
      api.start({
        y: window.innerHeight,
        immediate: reducedMotion,
        onRest: () => setShouldRender(false),
      });
      backdropApi.start({ backdropOpacity: 0, immediate: reducedMotion });
      if (reducedMotion) {
        queueMicrotask(() => setShouldRender(false));
      }
    }
  }, [isOpen, api, backdropApi, reducedMotion]);

  // Drag to dismiss gesture - bound to handle area only
  const bind = useDrag(
    ({ movement: [, my], velocity: [, vy], down, cancel }) => {
      // Only allow dragging down
      if (my < 0) {
        api.start({ y: 0, immediate: true });
        return;
      }

      if (down) {
        // While dragging, follow finger
        api.start({ y: my, immediate: true });
      } else {
        // On release, check if should dismiss
        const shouldDismiss =
          my > DISMISS_THRESHOLD || (vy > VELOCITY_THRESHOLD && my > 30);

        if (shouldDismiss) {
          // Dismiss with velocity
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
      }
    },
    {
      from: () => [0, y.get()],
      filterTaps: true,
      bounds: { top: 0 },
      rubberband: true,
      enabled: true,
    }
  );

  if (!isOpen && !shouldRender) {
    return null;
  }

  return (
    <>
      {/* Backdrop — keeps inline styles instead of .modal-backdrop per DESIGN.md */}
      <animated.div
        data-modal-backdrop="true"
        aria-hidden="true"
        className="fixed inset-0 z-50"
        style={{
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          opacity: backdropOpacity,
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
        onClick={onClose}
      />

      {/* Sheet */}
      <animated.div
        ref={(el: HTMLDivElement | null) => { sheetRef.current = el; }}
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
          y,
          maxHeight: `${maxHeightPercent}vh`,
          background: 'var(--color-bg-primary)',
          // Safe area padding for iPhone home indicator
          paddingBottom: `calc(env(safe-area-inset-bottom) + ${keyboardHeight}px)`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle - ONLY this area captures drag gestures */}
        {showHandle && (
          <div
            {...bind()}
            className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none"
          >
            <div
              className="w-10 h-1 rounded-full"
              style={{ background: 'var(--color-bg-tertiary)' }}
            />
          </div>
        )}

        {/* Header with title and close button - title area is draggable */}
        <div
          className="px-6 pb-3 border-b flex items-center justify-between"
          style={{ borderColor: 'var(--glass-border)' }}
        >
          {/* Spacer for centering */}
          <div className="w-8" />
          {title && (
            <h2
              id="bottom-sheet-title"
              {...bind()}
              className="text-lg font-medium text-center flex-1 cursor-grab active:cursor-grabbing touch-none"
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
      </animated.div>
    </>
  );
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
  const sheetRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setOpenedWithoutRuntime(false);
    } else if (isMobile && !runtime) {
      setOpenedWithoutRuntime(true);
    }
  }, [isOpen, isMobile, runtime]);

  useModalFocusTrap({
    isOpen,
    onClose,
    dialogRef: sheetRef,
    nodeKey: `${isMobile}-${Boolean(runtime)}`,
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

  // Mobile: full spring + drag sheet once runtime is ready
  if (runtime) {
    return (
      <MobileSpringBottomSheet
        runtime={runtime}
        isOpen={isOpen}
        wasAlreadyOpen={openedWithoutRuntime}
        onClose={onClose}
        sheetRef={sheetRef}
        title={title}
        maxHeightPercent={maxHeightPercent}
        showHandle={showHandle}
        className={className}
        keyboardHeight={keyboardHeight}
      >
        {children}
      </MobileSpringBottomSheet>
    );
  }

  // Mobile pre-load fallback: static accessible sheet until the gesture chunk arrives.
  if (!isOpen) return null;

  return (
    <>
      <div
        data-modal-backdrop="true"
        aria-hidden="true"
        className="fixed inset-0 z-50"
        style={{
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
        onClick={onClose}
      />

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
          paddingBottom: `calc(env(safe-area-inset-bottom) + ${keyboardHeight}px)`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {showHandle && (
          <div className="flex justify-center pt-3 pb-2">
            <div
              className="w-10 h-1 rounded-full"
              style={{ background: 'var(--color-bg-tertiary)' }}
            />
          </div>
        )}

        <div
          className="px-6 pb-3 border-b flex items-center justify-between"
          style={{ borderColor: 'var(--glass-border)' }}
        >
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

        <div
          className="overflow-y-auto touch-pan-y"
          style={{
            maxHeight: `calc(${maxHeightPercent}vh - ${title ? '80px' : '40px'} - env(safe-area-inset-bottom) - ${keyboardHeight}px)`,
          }}
        >
          {children}
        </div>
      </div>
    </>
  );
}
