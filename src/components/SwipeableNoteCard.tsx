import { useRef, useState, useCallback } from 'react';
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
}

// Swipe thresholds (in pixels)
const ACTION_THRESHOLD = 80; // Distance to reveal action
const TRIGGER_THRESHOLD = 140; // Distance to auto-trigger action
const VELOCITY_TRIGGER = 1.2; // Velocity to auto-trigger

/**
 * Swipeable wrapper for NoteCard with iOS-like gesture actions.
 *
 * - Swipe left → Delete action (red)
 * - Swipe right → Pin/Unpin action (gold)
 * - Spring physics for native feel
 * - Haptic feedback at thresholds
 */
export function SwipeableNoteCard({
  note,
  onClick,
  onDelete,
  onTogglePin,
  disabled = false,
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

  // Handle delete action
  const handleDelete = useCallback(async () => {
    setIsTriggering(true);
    triggerHaptic('heavy');

    // Animate off screen
    api.start({
      x: -window.innerWidth,
      config: { tension: 200, friction: 25 },
    });

    try {
      // Wait a moment for animation to be visible, then delete
      await new Promise((resolve) => setTimeout(resolve, 200));
      await Promise.resolve(onDelete(note.id));
    } catch {
      // Delete failed - snap card back to center
      api.start({
        x: 0,
        config: { tension: 300, friction: 20 },
      });
      setIsTriggering(false);
    }
  }, [api, note.id, onDelete, triggerHaptic]);

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

  // Gesture binding
  const bind = useDrag(
    ({ movement: [mx], velocity: [vx], direction: [dx], down, cancel, memo = { hapticTriggered: false } }) => {
      if (disabled || isTriggering) {
        cancel?.();
        return;
      }

      // Prevent card click during swipe
      if (Math.abs(mx) > 10 && containerRef.current) {
        containerRef.current.style.pointerEvents = 'none';
      }

      // Resistance when swiping beyond threshold
      const resistance = 0.5;
      let targetX = mx;

      // Apply resistance past thresholds
      if (mx < -ACTION_THRESHOLD) {
        targetX = -ACTION_THRESHOLD + (mx + ACTION_THRESHOLD) * resistance;
      } else if (mx > ACTION_THRESHOLD) {
        targetX = ACTION_THRESHOLD + (mx - ACTION_THRESHOLD) * resistance;
      }

      // Haptic feedback at threshold
      if (!memo.hapticTriggered && Math.abs(mx) >= ACTION_THRESHOLD) {
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

        // Check for delete trigger (left swipe)
        if (mx < -TRIGGER_THRESHOLD || (mx < -ACTION_THRESHOLD && vx > VELOCITY_TRIGGER && dx < 0)) {
          handleDelete();
          return memo;
        }

        // Check for pin trigger (right swipe)
        if (mx > TRIGGER_THRESHOLD || (mx > ACTION_THRESHOLD && vx > VELOCITY_TRIGGER && dx > 0)) {
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
      bounds: { left: -200, right: 200 },
      rubberband: true,
    }
  );

  // Calculate action visibility
  const deleteOpacity = x.to((val) => Math.min(1, Math.abs(Math.min(0, val)) / ACTION_THRESHOLD));
  const pinOpacity = x.to((val) => Math.min(1, Math.max(0, val) / ACTION_THRESHOLD));

  // Scale effect for action icons
  const deleteScale = x.to((val) => {
    const progress = Math.abs(Math.min(0, val)) / TRIGGER_THRESHOLD;
    return 0.8 + Math.min(progress, 1) * 0.4;
  });

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
      {/* Delete action (left side - revealed on left swipe) */}
      <animated.div
        className="absolute inset-y-0 right-0 flex items-center justify-end pr-6 pointer-events-none"
        style={{
          opacity: deleteOpacity,
          background: 'linear-gradient(to left, #dc2626, #ef4444)',
          borderRadius: 'var(--radius-card)',
          width: '100%',
        }}
      >
        <animated.div
          style={{ transform: deleteScale.to((s) => `scale(${s})`) }}
          className="flex flex-col items-center text-white"
        >
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
          <span className="text-xs font-medium mt-1">Delete</span>
        </animated.div>
      </animated.div>

      {/* Pin action (right side - revealed on right swipe) */}
      <animated.div
        className="absolute inset-y-0 left-0 flex items-center justify-start pl-6 pointer-events-none"
        style={{
          opacity: pinOpacity,
          background: note.pinned
            ? 'linear-gradient(to right, #6b7280, #9ca3af)' // Gray for unpin
            : 'linear-gradient(to right, var(--color-accent), #e6c547)', // Gold for pin
          borderRadius: 'var(--radius-card)',
          width: '100%',
        }}
      >
        <animated.div
          style={{ transform: pinScale.to((s) => `scale(${s})`) }}
          className="flex flex-col items-center text-white"
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
        />
      </animated.div>
    </div>
  );
}
