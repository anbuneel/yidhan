import { useRef, useState, useCallback, memo } from 'react';
import { useDrag } from '@use-gesture/react';
import { useSpring, animated, config } from '@react-spring/web';
import type { Note } from '../types';
import { NoteCard } from './NoteCard';

interface SwipeableNoteCardProps {
  note: Note;
  onClick: (id: string) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
  disabled?: boolean;
  isCompact?: boolean;
  searchQuery?: string;
}

// Swipe thresholds (in pixels)
const ACTION_THRESHOLD = 80; // Distance to reveal action
const TRIGGER_THRESHOLD = 140; // Distance to auto-trigger action
const VELOCITY_TRIGGER = 1.2; // Velocity to auto-trigger

/**
 * Swipeable wrapper for NoteCard with iOS-like gesture actions.
 *
 * - Swipe right → Pin/Unpin action (gold)
 * - Spring physics for native feel
 * - Haptic feedback at thresholds
 */
export const SwipeableNoteCard = memo(function SwipeableNoteCard({
  note,
  onClick,
  onDelete,
  onTogglePin,
  disabled = false,
  isCompact = false,
  searchQuery,
}: SwipeableNoteCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isTriggering, setIsTriggering] = useState(false);

  // Spring animation for the card position
  const [{ x }, api] = useSpring(() => ({
    x: 0,
    config: { ...config.stiff, clamp: true },
  }));

  // Haptic feedback helper
  const triggerHaptic = useCallback((intensity: 'light' | 'medium' | 'heavy' = 'medium') => {
    if ('vibrate' in navigator) {
      const duration = intensity === 'light' ? 5 : intensity === 'medium' ? 10 : 20;
      navigator.vibrate(duration);
    }
  }, []);

  // Handle pin action
  const handlePin = useCallback(() => {
    setIsTriggering(true);
    triggerHaptic('medium');

    // Bounce animation then toggle pin
    api.start({
      x: 0,
      config: config.wobbly,
      onRest: () => {
        onTogglePin(note.id, !note.pinned);
        setIsTriggering(false);
      },
    });
  }, [api, note.id, note.pinned, onTogglePin, triggerHaptic]);

  // Gesture binding (right-swipe only for pin/unpin)
  const bind = useDrag(
    ({ movement: [mx], velocity: [vx], direction: [dx], down, cancel, memo = { hapticTriggered: false } }) => {
      if (disabled || isTriggering) {
        cancel?.();
        return;
      }

      // Block left swipe — only allow right
      const clampedMx = Math.max(0, mx);

      // Prevent card click during swipe
      if (clampedMx > 10 && containerRef.current) {
        containerRef.current.style.pointerEvents = 'none';
      }

      // Resistance when swiping beyond threshold
      const resistance = 0.5;
      let targetX = clampedMx;

      if (clampedMx > ACTION_THRESHOLD) {
        targetX = ACTION_THRESHOLD + (clampedMx - ACTION_THRESHOLD) * resistance;
      }

      // Haptic feedback at threshold
      if (!memo.hapticTriggered && clampedMx >= ACTION_THRESHOLD) {
        triggerHaptic('light');
        memo.hapticTriggered = true;
      }

      if (down) {
        // During drag - follow finger
        api.start({ x: targetX, immediate: true });
      } else {
        // On release
        if (containerRef.current) {
          containerRef.current.style.pointerEvents = '';
        }

        // Check for pin trigger (right swipe)
        if (clampedMx > TRIGGER_THRESHOLD || (clampedMx > ACTION_THRESHOLD && vx > VELOCITY_TRIGGER && dx > 0)) {
          handlePin();
          return memo;
        }

        // Snap back to center
        api.start({ x: 0, config: config.stiff });
      }

      return memo;
    },
    {
      axis: 'x',
      filterTaps: true,
      bounds: { left: 0, right: 200 },
      rubberband: true,
    }
  );

  // Calculate action visibility
  const pinOpacity = x.to((val) => Math.min(1, Math.max(0, val) / ACTION_THRESHOLD));

  // Scale effect for action icon
  const pinScale = x.to((val) => {
    const progress = Math.max(0, val) / TRIGGER_THRESHOLD;
    return 0.8 + Math.min(progress, 1) * 0.4;
  });

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden touch-pan-y"
      style={{ borderRadius: 'var(--radius-card)' }}
    >
      {/* Pin action (right side - revealed on right swipe) */}
      <animated.div
        className="absolute inset-y-0 left-0 flex items-center justify-start pl-6 pointer-events-none"
        style={{
          opacity: pinOpacity,
          background: note.pinned
            ? 'linear-gradient(to right, var(--color-text-tertiary), var(--color-text-secondary))' // Gray for unpin
            : 'linear-gradient(to right, var(--color-accent), var(--color-accent-hover))', // Gold for pin
          borderRadius: 'var(--radius-card)',
          width: '100%',
        }}
      >
        <animated.div
          style={{ transform: pinScale.to((s) => `scale(${s})`), color: 'var(--color-on-accent)' }}
          className="flex flex-col items-center"
        >
          <svg
            className="w-7 h-7"
            fill={note.pinned ? 'none' : 'currentColor'}
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
            />
          </svg>
          <span className="text-xs font-medium mt-1">{note.pinned ? 'Unpin' : 'Pin'}</span>
        </animated.div>
      </animated.div>

      {/* Animated card */}
      <animated.div
        {...bind()}
        style={{
          x,
          touchAction: 'pan-y',
        }}
      >
        <NoteCard
          note={note}
          onClick={onClick}
          onDelete={onDelete}
          onTogglePin={onTogglePin}
          isCompact={isCompact}
          searchQuery={searchQuery}
        />
      </animated.div>
    </div>
  );
}, (prev, next) => prev.note === next.note && prev.disabled === next.disabled && prev.isCompact === next.isCompact && prev.searchQuery === next.searchQuery);
