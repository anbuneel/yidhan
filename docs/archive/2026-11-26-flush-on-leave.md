Status: COMPLETE
Last verified: 2026-11-27

# Save the note you leave (#288)

Issue: https://github.com/anbuneel/yidhan/issues/288. The first try (#287) added state to
the save path and kept finding new ways to lose words. This plan removes state instead.

## Design

1. **One Editor per note.** `NoteEditorView` renders the Editor with `key={note.id}`. A
   switch is an unmount and a mount. The render-time switch block in `Editor.tsx` goes,
   with `currentNoteIdRef`, `lastCommittedNoteIdRef` and the per-switch token. Every ref
   in an Editor instance now belongs to one note, so a save can never pair one note's id
   with another note's words.
2. **Save on leave.** When an Editor unmounts it cancels its debounce timer and saves its
   last title and content under its own note id, through the same `performSave` and
   `onUpdate` as every other save. One path covers switch, Back, browser Back, close and
   remount. The latest draft is copied to a ref in a layout effect, not during render, so
   a discarded concurrent render cannot leave its draft there.
3. **Held saves, above the Editor.** `src/stores/heldSaves.ts` is a small in-memory store
   (no persistence, never exported). An Editor that is gone and whose save failed adds an
   entry. `HeldSavesNotice` (rendered by `AppModals`, so it shows on the library and the
   editor) names each note and offers Retry and Copy.
4. **Retry never overwrites newer text.** Retry reads the note's current stored copy:
   - it already holds these words: drop the entry;
   - it still holds the text the words were written over (`baseTitle`, `baseContent`):
     save over it through `handleNoteUpdate`;
   - anything else (changed since, deleted, or locked on this device): keep both. The
     words go into a new note with `keepReleasedDraft`, as Keep does for a released note.
5. **Lock and sign-out**, below.

## Store shape and lifetime

```ts
interface HeldSave {
  key: string;         // the Editor instance that held the words; one entry per instance
  noteId: string;
  title: string;
  content: string;
  baseTitle: string;   // the stored text the words were written over
  baseContent: string;
  attemptedAt: number;
  detail: string;      // error text, if it is safe to show
}
```

- Added only by an unmounted Editor whose save failed. A mounted Editor keeps showing its
  own "Not saved" banner, as today.
- Removed by: Retry that saves or copies; Copy that succeeds; a later successful save
  from the **same** Editor instance (its draft contains the held words). A save from a
  later Editor for the same note does **not** remove it: that editor opened the older
  stored text and does not have the held words.
- Cleared, and closed to new entries, whenever the vault is locked or the user changes.
  Every close starts a new session; a save that started in an earlier session can
  neither write nor hold, even after the store opens again. A save that failed
  because the vault is locked is never held.
- Copy and Retry release only the entry revision they handled; a newer failure of the
  same Editor stays. One retry per entry runs at a time.

## Saves across Editor instances

`src/stores/noteSaveQueue.ts` orders writes for one note across Editor instances, so
the old Editor's leave save and the new one's saves never race. It also keeps the
newest draft still waiting to be written; a reopened Editor starts from it, so words
queued behind a slow save are on screen and not typed over. Retry's save-over runs in
the same queue.

## The five cases

1. **Switch inside the 800ms debounce.** A unmounts and saves its own words under A's id.
2. **Close inside the debounce** (Back, browser Back, the note becoming locked). Same
   unmount save. A note that becomes locked mid-edit unmounts the Editor; its save reaches
   `handleNoteUpdate`, which already refuses to write over a `decryptionFailed` note, so
   the words are held and Retry offers a copy.
3. **Leaving a "Not saved" note.** The draft differs from the last saved copy, so the
   unmount save retries it. If that fails the words are held.
4. **Typing during a slow switch.** The transition renders a new Editor for B. A's
   instance and state are untouched until B commits, so typing on A cannot revert. When B
   commits, A saves what was on screen.
5. **A save that fails after leaving.** The failure lands in the held store and the notice
   shows it, on whichever screen is open.

## What does not change

- The 800ms debounce and the 10s checkpoint for a note that stays on screen.
- Self-echo detection: a new Editor starts with the stored copy as its committed snapshot.
  The `pendingMutations` set in the sync engine is not touched.
- "Synced" still needs the server-confirmed hash. Held entries never claim a sync state.

## Must not happen, and how

- No unmount save for a note released elsewhere (`releasedElsewhere`), or one the writer
  deleted from this Editor (a flag set before `onDelete`, cleared if delete fails). A
  released note left by a route change, not by Let go, has its words held; Retry keeps
  them as a new note.
- No unmount save for a locked note: `handleNoteUpdate` refuses, as today.
- No empty unmount save over a note that had words. Clearing a note is saved by the
  debounce while the writer stays; leaving inside the window keeps the old words.
- `handleNoteUpdate` reads the vault keys from a ref, so a save that runs after the vault
  locked fails closed instead of encrypting with keys from an older render.
- StrictMode: the effect's mount-unmount-mount at start finds nothing to save.

## Keep as new note

Keep writes the released draft into a new note and the route moves to it, which now
remounts the Editor. Words typed while Keep was writing would be lost. The leaving Editor
remembers the kept note and, on unmount, saves any newer words into it.

## Lock and sign-out

- **Lock now** (Settings, library only): flush the open Editor, wait for saves still
  running from Editors already gone, then retry held ones, for at most 3s. If anything
  is still unsaved, the vault stays unlocked, Settings closes and the notice says so,
  with Retry, Copy and "Lock anyway". Once Retry or Copy deals with the last entry,
  the lock goes ahead, saving first again, unless the writer has opened a note.
- **Auto-lock**: the same saving, bounded at 3s, then clear the store and lock. A hung
  write never keeps an idle vault open. If words were dropped, a toast says so.
- **Sign-out** (any path): clear the store. Sign-out already deletes the offline database
  (`clearOfflineData`), so a flush to IndexedDB first would be deleted with it.

What this can still lose, to say in the PR:
- A save that keeps failing up to an auto-lock or sign-out. The words are dropped from
  memory so decrypted text does not outlive the vault.
- Anything not yet synced at sign-out. That is existing behaviour (`clearOfflineData`)
  and is out of scope here.
- Words typed in the moment between the auto-lock flush and the lock itself.

## Tests, written first

`src/components/Editor.leave.test.tsx` renders `NoteEditorView` with a parent that keeps
notes like the app does:

- switch inside the debounce saves the leaving note under its own id;
- A to B to A with the save pending shows the newest text;
- a save that fails after the editor closed shows the notice;
- Retry after newer edits keeps both (copy), and Retry with no newer edits saves over;
- a suspended transition does not revert typing;
- StrictMode: exactly one save;
- a clean switch saves nothing;
- no save for a released note, a deleted note, or an empty draft over words;
- a real remote edit after a remount is not taken for an echo;
- the debounce and checkpoint timings for a note that stays.

Store and lock tests sit next to their units.
