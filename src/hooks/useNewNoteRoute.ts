/**
 * `/n/new` (item 44): create one note and open it.
 *
 * The create starts once per arrival, and only when `ready` says the vault is open and
 * the list has loaded. A signed-out or locked reader sees the sign-in or unlock screen
 * first, and the create waits for it. `open` replaces `/n/new` with `/n/<id>`, so a
 * reload or Back never lands on `/n/new` again. The ref holds across StrictMode's
 * second effect run, so that run does not start a second create.
 */

import { useEffect, useEffectEvent, useRef } from 'react';

export interface UseNewNoteRouteOptions {
  /** The route is `/n/new`. */
  requested: boolean;
  /** Signed in, unlocked, writes allowed, and the note list has loaded. */
  ready: boolean;
  /** Creates the note and calls `open` with its id. Resolves false if it failed. */
  create: (open: (noteId: string) => void) => Promise<boolean>;
  /** Replace `/n/new` with the new note's address. */
  open: (noteId: string) => void;
  /** The create failed. */
  onFailed: () => void;
}

export function useNewNoteRoute({ requested, ready, create, open, onFailed }: UseNewNoteRouteOptions): void {
  const startedRef = useRef(false);

  // Read at call time: a reader who left `/n/new` while the create ran stays where
  // they went. The note still exists, in the library.
  const openIfStillHere = useEffectEvent((noteId: string) => {
    if (requested) open(noteId);
  });
  const failIfStillHere = useEffectEvent(() => {
    if (requested) onFailed();
  });
  const start = useEffectEvent(() => {
    void create((noteId) => openIfStillHere(noteId)).then(
      (created) => { if (!created) failIfStillHere(); },
      () => failIfStillHere(),
    );
  });

  useEffect(() => {
    if (!requested) {
      startedRef.current = false;
      return;
    }
    if (!ready || startedRef.current) return;
    startedRef.current = true;
    start();
  }, [requested, ready]);
}
