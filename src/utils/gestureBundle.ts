/**
 * Async gesture chunk entry point (A1c).
 *
 * Isolates @react-spring/web, @use-gesture/react, and springMotion behind a single
 * dynamic import so the library paints first on every device before these modules
 * are parsed. Never import this file statically outside type-only imports.
 */
import { useDrag } from '@use-gesture/react';
import { useSpring, animated, config, SpringValue } from '@react-spring/web';
import { useSpringReducedMotion } from './springMotion';

export interface GestureRuntime {
  useDrag: typeof useDrag;
  useSpring: typeof useSpring;
  animated: typeof animated;
  config: typeof config;
  SpringValue: typeof SpringValue;
  useSpringReducedMotion: typeof useSpringReducedMotion;
}

export const gestureRuntime: GestureRuntime = {
  useDrag,
  useSpring,
  animated,
  config,
  SpringValue,
  useSpringReducedMotion,
};
