/**
 * Library gestures on a touch-capable device, with the real use-gesture library.
 *
 * The library wraps its cards in two gestures: PullToRefresh around the list
 * (touch events) and SwipeableNoteCard around each card (pointer events). Both
 * load after first paint. A click inside a card has to get past both.
 *
 * The bug this covers: PullToRefresh used use-gesture's `filterTaps`, which stops
 * every click whose gesture it did not see as a tap. It listens to touch only, so
 * it never saw a mouse press, and every mouse or trackpad click inside the library
 * did nothing on a touchscreen laptop once the chunk loaded.
 *
 * The cases where nothing should fire come first.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { PullToRefresh } from './PullToRefresh';
import { SwipeableNoteCard } from './SwipeableNoteCard';
import { createMockNote } from '../test/factories';
import { REDUCED_MOTION_QUERY } from '../utils/springMotion';
import {
  resetGestureRuntimeForTests,
  setGestureBundleImporterForTests,
} from '../utils/gestureRuntime';
import type { Note } from '../types';

// jsdom has no pointer capture. use-gesture calls these on every pointer press.
const captured = new WeakMap<Element, Set<number>>();
beforeEach(() => {
  Element.prototype.setPointerCapture = function (id: number) {
    const ids = captured.get(this) ?? new Set<number>();
    ids.add(id);
    captured.set(this, ids);
  };
  Element.prototype.releasePointerCapture = function (id: number) {
    captured.get(this)?.delete(id);
  };
  Element.prototype.hasPointerCapture = function (id: number) {
    return captured.get(this)?.has(id) ?? false;
  };
});

// Reduced motion makes the swipe-to-pin settle at once instead of after a spring.
const originalMatchMedia = window.matchMedia;
beforeEach(() => {
  window.matchMedia = vi.fn((query: string) => ({
    matches: query === REDUCED_MOTION_QUERY,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});
afterEach(() => {
  window.matchMedia = originalMatchMedia;
  resetGestureRuntimeForTests();
});

// --- Event helpers -----------------------------------------------------------

type PointerKind = 'mouse' | 'touch';

function pointer(el: Element, type: string, kind: PointerKind, x: number, y: number) {
  el.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: kind === 'mouse' ? 1 : 2,
      pointerType: kind,
      isPrimary: true,
      clientX: x,
      clientY: y,
      buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1,
    })
  );
}

/** A touch event with plain touch points; jsdom has no Touch constructor. */
function touch(el: Element, type: 'touchstart' | 'touchmove' | 'touchend' | 'touchcancel', x: number, y: number) {
  const point = { identifier: 7, target: el, clientX: x, clientY: y };
  const active = type === 'touchend' || type === 'touchcancel' ? [] : [point];
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    touches: { value: active },
    targetTouches: { value: active },
    changedTouches: { value: [point] },
  });
  el.dispatchEvent(event);
}

/** A click the way a browser sends one after a press: `detail` is the click count. */
function click(el: Element) {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
}

/** A mouse or trackpad click, as Chrome orders it. */
function mouseClick(el: Element) {
  pointer(el, 'pointerdown', 'mouse', 50, 50);
  el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, detail: 1 }));
  pointer(el, 'pointerup', 'mouse', 50, 50);
  el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, detail: 1 }));
  click(el);
}

/**
 * A finger pull down from `fromY`. The card sees the press, then the browser takes
 * the vertical pan and cancels the pointer; the touch events carry on.
 */
function touchPull(el: Element, fromY: number, ys: number[]) {
  pointer(el, 'pointerdown', 'touch', 50, fromY);
  touch(el, 'touchstart', 50, fromY);
  pointer(el, 'pointermove', 'touch', 50, fromY + 8);
  touch(el, 'touchmove', 50, fromY + 8);
  pointer(el, 'pointercancel', 'touch', 50, fromY + 8);
  for (const y of ys) touch(el, 'touchmove', 50, y);
  touch(el, 'touchend', 50, ys[ys.length - 1]);
}

/** A finger tap, as Chrome on Android orders it. */
function touchTap(el: Element) {
  pointer(el, 'pointerdown', 'touch', 50, 50);
  touch(el, 'touchstart', 50, 50);
  pointer(el, 'pointerup', 'touch', 50, 50);
  touch(el, 'touchend', 50, 50);
  click(el);
}

// --- Rendering ----------------------------------------------------------------

interface Handlers {
  onClick: ReturnType<typeof vi.fn>;
  onDelete: ReturnType<typeof vi.fn>;
  onTogglePin: ReturnType<typeof vi.fn>;
  onRefresh: ReturnType<typeof vi.fn>;
}

function renderLibrary(note: Note = createMockNote({ title: 'Field notes' })) {
  const handlers: Handlers = {
    onClick: vi.fn(),
    onDelete: vi.fn().mockResolvedValue(true),
    onTogglePin: vi.fn(),
    onRefresh: vi.fn().mockResolvedValue(undefined),
  };
  const ui = (
    <PullToRefresh onRefresh={handlers.onRefresh}>
      <SwipeableNoteCard
        note={note}
        onClick={handlers.onClick}
        onDelete={handlers.onDelete}
        onTogglePin={handlers.onTogglePin}
      />
    </PullToRefresh>
  );
  const view = render(ui);
  return { ...view, ui, handlers, note };
}

/** Both gesture layers are mounted: the pin backdrop and the pull indicator. */
async function waitForGestures(container: HTMLElement) {
  await waitFor(() => {
    expect(container.querySelector('.touch-pan-y > .absolute.inset-y-0')).not.toBeNull();
    expect(container.querySelector('.z-50.pointer-events-none')).not.toBeNull();
  });
  // use-gesture binds its listeners in an effect after the layer mounts.
  await act(async () => {});
}

const openButton = () => screen.getByRole('button', { name: 'Open note: Field notes' });
const pinButton = () => screen.getByRole('button', { name: 'Pin note' });
const deleteButton = () => screen.getByRole('button', { name: 'Delete note' });
/** NoteCard starts its fade on a delete press and disables the button. */
const deleteWasPressed = () => (deleteButton() as HTMLButtonElement).disabled;
const cardWrapper = (container: HTMLElement) =>
  container.querySelector('.touch-pan-y > .relative') as HTMLElement;

// --- Where nothing should fire -------------------------------------------------

describe('library gestures: where nothing should fire', () => {
  it('a swipe that starts on Delete swipes the card and does not delete', async () => {
    const { container, handlers, note } = renderLibrary();
    await waitForGestures(container);
    const del = deleteButton();

    // A mouse drag: the browser does send a click after it.
    pointer(del, 'pointerdown', 'mouse', 20, 50);
    for (const x of [40, 80, 120, 160, 200]) pointer(del, 'pointermove', 'mouse', x, 50);
    pointer(del, 'pointerup', 'mouse', 200, 50);
    click(del);

    await waitFor(() => expect(handlers.onTogglePin).toHaveBeenCalledWith(note.id, true));
    expect(deleteWasPressed()).toBe(false);
    expect(handlers.onClick).not.toHaveBeenCalled();
  });

  it('a touch swipe that starts on Pin pins once, by the swipe, not twice', async () => {
    const { container, handlers, note } = renderLibrary();
    await waitForGestures(container);
    const pin = pinButton();

    pointer(pin, 'pointerdown', 'touch', 20, 50);
    for (const x of [40, 80, 120, 160, 200]) pointer(pin, 'pointermove', 'touch', x, 50);
    pointer(pin, 'pointerup', 'touch', 200, 50);
    click(pin);

    await waitFor(() => expect(handlers.onTogglePin).toHaveBeenCalledWith(note.id, true));
    expect(handlers.onTogglePin).toHaveBeenCalledTimes(1);
    expect(handlers.onClick).not.toHaveBeenCalled();
  });

  it('a vertical scroll that starts on a card neither swipes, taps nor refreshes', async () => {
    const { container, handlers } = renderLibrary();
    await waitForGestures(container);
    const open = openButton();

    // Finger moves up to scroll the list down. The browser takes the pan and
    // cancels the pointer; it sends no click.
    pointer(open, 'pointerdown', 'touch', 50, 300);
    touch(open, 'touchstart', 50, 300);
    pointer(open, 'pointermove', 'touch', 50, 290);
    touch(open, 'touchmove', 50, 290);
    pointer(open, 'pointercancel', 'touch', 50, 290);
    for (const y of [250, 200, 150]) touch(open, 'touchmove', 50, y);
    touch(open, 'touchend', 50, 150);
    await act(async () => {});

    expect(cardWrapper(container).style.transform).toBe('');
    expect(handlers.onTogglePin).not.toHaveBeenCalled();
    expect(handlers.onClick).not.toHaveBeenCalled();
    expect(handlers.onRefresh).not.toHaveBeenCalled();
    expect(deleteWasPressed()).toBe(false);
  });

  it('a pull to refresh that starts on Delete refreshes and does not delete', async () => {
    const { container, handlers } = renderLibrary();
    await waitForGestures(container);
    const del = deleteButton();

    touchPull(del, 10, [40, 100, 200, 300, 400]);
    // Browsers send no click after a pull. If one arrives anyway, the card's drag
    // saw the press move and filters it.
    click(del);

    await waitFor(() => expect(handlers.onRefresh).toHaveBeenCalledTimes(1));
    expect(deleteWasPressed()).toBe(false);
    expect(handlers.onClick).not.toHaveBeenCalled();
  });

  it('after a pull, the next separate click still lands', async () => {
    const { container, handlers } = renderLibrary();
    await waitForGestures(container);
    const del = deleteButton();

    touchPull(del, 10, [40, 100, 200, 300]);
    click(del); // filtered: part of the pull
    await waitFor(() => expect(handlers.onRefresh).toHaveBeenCalled());

    mouseClick(openButton());
    expect(handlers.onClick).toHaveBeenCalledTimes(1);
  });
});

// --- Where the press should land -------------------------------------------------

describe('library gestures: a press on a card button reaches it', () => {
  it('a mouse click opens, pins and deletes before the gesture chunk loads', async () => {
    setGestureBundleImporterForTests(() => new Promise(() => {}));
    const { container, handlers, note } = renderLibrary();
    await act(async () => {});
    expect(container.querySelector('.touch-pan-y > .absolute.inset-y-0')).toBeNull();

    mouseClick(openButton());
    expect(handlers.onClick).toHaveBeenCalledWith(note.id);
    mouseClick(pinButton());
    expect(handlers.onTogglePin).toHaveBeenCalledWith(note.id, true);
    mouseClick(deleteButton());
    await waitFor(() => expect(deleteWasPressed()).toBe(true));
  });

  it('a mouse click opens, pins and deletes after the gesture chunk loads', async () => {
    const { container, handlers, note } = renderLibrary();
    await waitForGestures(container);

    mouseClick(openButton());
    expect(handlers.onClick).toHaveBeenCalledWith(note.id);
    mouseClick(pinButton());
    expect(handlers.onTogglePin).toHaveBeenCalledWith(note.id, true);
    expect(handlers.onTogglePin).toHaveBeenCalledTimes(1);
    mouseClick(deleteButton());
    await waitFor(() => expect(deleteWasPressed()).toBe(true));
  });

  it('a finger tap opens, pins and deletes after the gesture chunk loads', async () => {
    const { container, handlers, note } = renderLibrary();
    await waitForGestures(container);

    touchTap(openButton());
    expect(handlers.onClick).toHaveBeenCalledWith(note.id);
    touchTap(pinButton());
    expect(handlers.onTogglePin).toHaveBeenCalledWith(note.id, true);
    expect(handlers.onTogglePin).toHaveBeenCalledTimes(1);
    touchTap(deleteButton());
    await waitFor(() => expect(deleteWasPressed()).toBe(true));
  });

  it('a mouse click still lands after the library remounts', async () => {
    const first = renderLibrary();
    await waitForGestures(first.container);
    first.unmount();

    const { container, handlers, note } = renderLibrary();
    await waitForGestures(container);
    mouseClick(openButton());
    expect(handlers.onClick).toHaveBeenCalledWith(note.id);
  });

  it('a keyboard press on a card button is never filtered', async () => {
    const { container, handlers, note } = renderLibrary();
    await waitForGestures(container);
    // Enter and Space send a click with detail 0.
    openButton().dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 }));
    expect(handlers.onClick).toHaveBeenCalledWith(note.id);
  });
});
