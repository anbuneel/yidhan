Status: PROPOSAL
Last verified: 2026-11-25

# Launch review work order

The 27 items chosen from the 2026-11-24 launch review, grouped into tracks by the files
they touch. The review merged three passes (Claude, Gemini, Codex) over the live site
and the source at `953792b`.

This is a proposal. It does not replace `2026-11-07-public-launch-plan.md`, which stays
ACTIVE. Nothing here is approved until its items move into that plan's **Now**. Ledger
numbers are assigned then, from 164 up; the letter IDs below are the review's own.

## What this does not cover

All nine launch gates (A1 to A9) were set to Later: domain, SMTP, the two-account
isolation test, deployed migrations, the three acceptance tests, the real-device pass,
the Lighthouse run, the cohort and the security review. They stay in the ACTIVE plan.
**A public announcement is still blocked on them.** This work order makes the product
and its public pages ready; it does not make the launch ready.

The other 33 Later items stay where they are: on `docs/roadmap.md`, in the issue
tracker, or unrecorded if they were new ideas. See "Later items with no home" below.

## Tracks at a glance

| Track | Items | Can start | Runs beside |
|---|---|---|---|
| A · Copy and small polish | C1 to C8, B5, B10, B15 | Now | Everything |
| B · Editor | B1, B7, B8, B12 | Now | A, D. Merge before C |
| C · Dialogs and motion | B2, B3, B4 | Now | A, D. Rebase onto B |
| D · Landing page | D2 to D7, D9 | When the headline wording is picked | A, B, C |
| E · Passkey unlock | E1 | After A, B and C merge | Nothing; it needs the heavier review |
| F · Quick capture | E5 | Blocked on roadmap item 28 | — |

One track is one branch, one PR and one agent session. Tracks running at the same time
need a worktree each, or they overwrite each other.

**Conflicts to expect when merging:**

- `src/data/changelog.ts` and `docs/progress.md`. Every PR adds an entry in the same
  place and claims the next version number. The second PR to merge rebases and
  renumbers.
- `src/components/Editor.tsx`. Track B owns it. Track C must not edit it; see C.
- `src/index.css`. B3 edits it, and B8 may.

## Rules for every track

- Read `AGENTS.md` first. Do not edit it; it is generated from `CLAUDE.md`.
- Plain, direct writing in copy, comments, commits and the PR description. Sentence
  case. No invented testimonials, counts or press.
- Never hardcode a colour. Radius, type and colour come from the tokens in `DESIGN.md`.
- `docs/archive/` is frozen. Do not cite it or edit it.
- Each "done when" ships as a test in the same PR, with the "should not fire" cases.
- Add a `src/data/changelog.ts` entry: read the first 40 lines and insert directly
  after `export const changelog: ChangelogEntry[] = [`. Never read the file whole.
  Append one entry to `docs/progress.md`.
- Run only the test file you changed while iterating. Run `npm run check` once before
  pushing. Do not merge the PR.
- Several items are marked **unverified**. Confirm the bug exists before fixing it. If
  it does not, say so in the PR and leave the code alone.

## Open questions

1. **Settled 2026-11-24: encryption goes into the headline (D2).** D1, keeping "A notes
   app built around writing.", is dropped. The wording is still to pick; see track D.
2. **C2 depends on a fact nobody checked.** The deletion flow exists in code. Whether
   self-serve deletion is switched on in production is unconfirmed.
3. **E5 has an unmet need.** Roadmap item 44 (the "New note" shortcut) needs item 28,
   per-note routes, and no `/n/` route exists in `src`. Either item 28 ships first, or
   the shortcut opens the library with a "new note" flag and item 44's "done when" is
   reworded. Item 47 (share target) also needs the service-worker test harness.

---

## Track A · Copy and small polish

Public pages and the README contradict the shipped product. No behaviour changes.
PR title: `Public copy matches the product (launch review track A)`. Hours to a day.

| ID | Change | Where |
|---|---|---|
| C1 | The licence section says `MIT` (line 268). The repo is AGPL-3.0. Also remove coloured tags and the colour picker (lines 21-22, 218, the "Tag Colors" section), old starter notes and old theme names | `README.md` |
| C3 | "I forgot my passphrase" says notes cannot be recovered. New answer: the recovery key opens the notes and lets you set a new passphrase; if both are lost, no one can restore them. Agree with the paragraph higher on the page | `src/components/SupportPage.tsx` line 131 |
| C4 | "Additional OAuth providers" lists GitHub as exploring. GitHub sign-in is live. Remove GitHub; Apple stays | `src/data/roadmap.ts` |
| C5 | "Usage analytics" reads like tracking. Say it is computed on the device and nothing leaves it, or remove it | `src/data/roadmap.ts` |
| C6 | Remove "Testing coverage expansion". Move "Image attachments" and "Virtual scrolling" from coming soon to exploring; neither is committed. Add "Encrypted tag names" under exploring | `src/data/roadmap.ts` |
| C7 | Replace "quiet space" with plain wording in the current voice. Leave `PlaygroundPage.tsx` unless users can reach it; say which | `ChapteredLibrary.tsx` line 232, `SharedNoteView.tsx` line 455 |
| C8 | Remove the licence "Open question" bullet under "Evidence on hand" | `PRODUCT.md` |
| B5 | The welcome note still says "light (Kintsugi) and dark (Midnight)" and mentions wabi-sabi (issue #271). Add a **new** migration replacing the trigger function. Do not edit `create_welcome_note_trigger.sql`. List the new migration in `verify_migration_state.sql`. The maintainer applies it by hand; say so in the PR | `supabase/migrations/` |
| B10 | "+ Tag" wraps onto its own line on a phone. Keep it on the tag row | `src/components/TagFilterBar.tsx` |
| B15 | **Unverified.** Buttons on shared letters and empty states should use `--radius-pill` | `SharedNoteView.tsx`, `ChapteredLibrary.tsx` |
| C2 | **Do not change yet.** Support (line 140) and Privacy (line 215) say self-serve deletion is "paused for public launch". Check whether a flag or guard disables it. Report what you find. Change the copy only if a signed-in user can reach deletion with nothing in the way; then describe the real flow | `SupportPage.tsx`, `PrivacyPage.tsx` |

Done when: `rg -n "quiet space|Kintsugi|Midnight|wabi"` returns nothing outside
`docs/archive/`, `changelog.ts` and old migrations; `README.md` has no "MIT"; a test
fails if the public roadmap lists GitHub sign-in as not shipped; no lone "+ Tag" line at
375px with three tags.

Should not change: existing accounts' welcome notes, the demo starter notes, the tag
row on desktop, any behaviour. Tests that assert the old copy are updated in this PR.

Do not touch: `index.html`, `LandingPage.tsx`, the hero copy (track D); `Editor.tsx`,
`EditorToolbar.tsx` (track B); any dialog (track C).

## Track B · Editor

PR title: `Editor: phone menu, focus mode, undo, demo label (launch review track B)`.
Days. Owns `Editor.tsx`, `EditorToolbar.tsx`, `EditorSidebar.tsx`,
`src/editor/editorCommands.tsx`.

| ID | Change | Done when |
|---|---|---|
| B1 | On a phone the "More editor commands" menu opens below the screen: at 390 by 844 it runs from y=790 to y=1618. It is `position: fixed` inside a `backdrop-filter` ancestor, so it is placed against the bottom toolbar, not the viewport (`EditorToolbar.tsx`, near line 91). Move it out of that ancestor or position it another way | At 390 by 844 the whole menu is inside the viewport and every command can be tapped · E2E |
| B8 | Focus mode is only inside the command menu. Give it one visible, quiet control: in `EditorSidebar` on desktop and in the bottom toolbar on a phone, using the on-accent tokens when active | A new visitor can enter and leave focus mode without opening a menu · E2E |
| B12 | **Unverified.** Undo after switching notes can alter the previous note (roadmap 114). Clear history when the note changes, without emitting an update | Undo after switching notes cannot change the previous note · unit test |
| B7 | The practice editor does not say drafts are unencrypted. Show "Demo · saved in this browser · not encrypted" while writing there | The label shows in the practice editor and never for a signed-in account · E2E |

Should not fire: the desktop command menu keeps its position. The menu still closes on
outside tap and Escape. Undo inside one note still works after an autosave. The
focus-mode control adds nothing to note cards or the library. The "not encrypted" label
never shows on an encrypted note. The manuscript glow stays a ref-based
`requestAnimationFrame` handler with no re-renders. A failed save still keeps the draft.

Not verified by this track: the menu with a real virtual keyboard up. That needs the
real-device pass (launch gate A6). Say so in the PR.

Do not touch: dialog focus handling (track C), even for the dialog inside `Editor.tsx`.

## Track C · Dialogs and motion

PR title: `Dialogs hold focus; reduced motion; honest sign-up prompt (launch review track C)`.
Days. Rebase onto track B before merging.

| ID | Change | Done when |
|---|---|---|
| B2 | Dialogs do not hold keyboard focus (issue #257). Tab from the sign-up dialog lands on "New note" behind it. Every modal takes focus on open, holds it, makes the page behind inert and returns focus on close. Use one shared hook or component, not a copy per dialog. About 14 files render a dialog: `Auth`, `InvitationModal`, `ConflictModal`, `EncryptedConflictModal`, `BackupPassphraseModal`, `LettingGoModal`, `SessionTimeoutModal`, `KeyboardShortcutsModal`, `BottomSheet`, `IOSInstallGuide`, `InstallPrompt`, `FadedNotesView`, `LinkPopover`, and one inside `Editor.tsx` | Tab and Shift+Tab never leave an open modal; focus returns to the control that opened it · component test per dialog kind and one E2E |
| B3 | Spring animations ignore `prefers-reduced-motion` on touch devices (issue #258) | No spring runs with reduced motion on · unit test |
| B4 | The sign-up prompt says "You've written 5 thoughts here" to a visitor who wrote nothing. It counts the starter notes. Count only notes the visitor created or edited | A visitor who changed nothing is never told they wrote notes · unit test |

`Editor.tsx` belongs to track B. Apply the shared hook to the dialog inside it only
after track B has merged, as the last commit of this PR. If B has not merged, leave
that one dialog and list it in the PR.

Should not fire: focus is not trapped by non-modal surfaces: the toolbar, the tag
picker, toasts, `LinkPopover` if it is a popover and not a modal. Escape still closes
each dialog. A dialog opened from another dialog returns focus to the first. The
sign-up prompt does not open behind another dialog or while the visitor is typing.
`ReAuthModal` and the passphrase screens keep their current order of fields.

## Track D · Landing page

PR title: `Landing page: private writing, editor first (launch review track D)`. Weeks.
Starts when the headline wording is picked.

- **D2, D3, D4.** A new headline that names writing and privacy together. Candidates:
  "A private notes app built around writing." · "Notes built around writing, encrypted
  before they leave your device." · "Write freely. Only you can read it." Shorter
  supporting text. The claim is the writing workflow made private, not encryption
  alone: Standard Notes and Notesnook already offer encrypted notes. Claim only what
  the security page backs: titles and content are encrypted; tags, dates and sizes are
  not.
- **D5.** The editor sheet is visible without scrolling on a laptop and starts higher
  on a phone. It starts near y=700 at 390px today.
- **D6.** Each sample note opens that note in the practice space. Today all three call
  the same handler and open the library (`LandingPage.tsx` line 188, `App.tsx`).
- **D7.** One short section for what the page hides: chapters, search, Share as Letter,
  phone and offline use.
- **D9.** A compact FAQ: browsers and installing, what is free and how it is paid for,
  importing, recovery. No "free forever".

Done when: the sheet's top edge is inside the first screen at 1280 by 800 and at 390 by
844; each sample opens its own note; the FAQ answers the four questions.

Constraints: `index.html`'s landing shell mirrors `LandingPage.tsx`, so both change
together. `public/boot.js` and the first-visit budget still hold; the budget check must
pass. The headline reverses the 2026-11-10 decision, so this PR appends a
`DECISIONS.md` entry and changes the page title, the share text and the share image
(`scripts/brand/flatten.py`, with the `og:image` version bumped) together.

Should not fire: a signed-in visitor still goes to the app shell, not the landing page.
A sample link does not create a second copy of a starter the visitor already edited.

## Track E · Passkey unlock

Item E1: roadmap 135. Weeks. Its needs (items 24 and 26) have shipped. Measure WebAuthn
PRF support in the target browsers first. The passphrase stays as the fallback. It
touches encryption and auth, so it gets the multi-agent review.

## Track F · Quick capture

Item E5: roadmap 44, then 47. Blocked on open question 3.

---

## Later items with no home

These were new ideas in the review and are marked Later. They are not on
`docs/roadmap.md`. Add the ones worth keeping, or they are lost:

- Live "what the server sees" proof on the security page
- Revision asides, stripped on copy, export and share
- Paragraph focus inside focus mode
- Resume exactly
- Gather a draft
- Sealed notes that open on a date
- One-view letters
- Commonplace book
- Open beside, read-only
- Self-fading scratchpad notes
- Proofread mode
- On-device voice capture
- Trusted-person recovery
- "Keep these notes" previews the steps that follow (B9)
- Demo header overlap at tablet widths (B6), not reproduced
- Empty band above "Pinned" on first load (B11), not confirmed
