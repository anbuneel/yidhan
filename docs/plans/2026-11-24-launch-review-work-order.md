Status: PROPOSAL
Last verified: 2026-11-24

# Launch review work order

The 27 items chosen from the 2026-11-24 launch review, in build order. The review merged
three passes (Claude, Gemini, Codex) over the live site and the source at `953792b`.

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

## Open questions

Two things to settle before the affected step starts. The first was settled on
2026-11-24.

1. **Settled: encryption goes into the headline (D2).** D1 and D2 were both marked Do
   and contradicted each other. D1, keeping "A notes app built around writing.", is
   dropped. The new headline still leads with writing and adds privacy to it; the
   wording is chosen in step 5. Candidates to start from:
   - "A private notes app built around writing."
   - "Notes built around writing, encrypted before they leave your device."
   - "Write freely. Only you can read it."

   This reverses the 2026-11-10 decision, so step 5 appends a `DECISIONS.md` entry.
   The headline is also the page title, the share text and the share image, so all
   four change together.
2. **C2 depends on a fact nobody checked.** The deletion flow exists in code. Whether
   self-serve deletion is switched on in production is unconfirmed. Check it signed in
   before changing the Support and Privacy copy.
3. **E5 has an unmet need.** Roadmap item 44 (the "New note" shortcut) needs item 28,
   per-note routes, and no `/n/` route exists in `src`. Either item 28 ships first, or
   the shortcut opens the library with a "new note" flag and item 44's "done when" is
   reworded. Item 47 (share target) also needs the service-worker test harness.

## Order

One step is one PR and one session. Each step ships its "done when" as tests in the
same PR. Each also carries the cases where the change should not fire.

### Step 1 · Public copy matches the product

Items C1, C3, C4, C5, C6, C7, C8, B5, and C2 once question 2 is answered. Hours.

| ID | Change | Where |
|---|---|---|
| C1 | Licence line says AGPL-3.0. Remove coloured tags, the colour picker and old starter notes | `README.md` |
| C2 | Remove "deletion is paused" if deletion is live; otherwise say how to request it | `SupportPage.tsx`, `PrivacyPage.tsx` |
| C3 | "I forgot my passphrase" names the recovery key before saying notes are lost | `SupportPage.tsx` |
| C4 | GitHub sign-in moves to shipped or is removed | `src/data/roadmap.ts` |
| C5 | "Usage analytics" says "computed on your device", or is removed | `src/data/roadmap.ts` |
| C6 | Drop "Testing coverage". "Coming soon" holds only committed work. Add encrypted tag names | `src/data/roadmap.ts` |
| C7 | Replace "quiet space" in the library empty state and the shared-letter footer | `ChapteredLibrary.tsx`, `SharedNoteView.tsx` |
| C8 | Remove the licence open question | `PRODUCT.md` |
| B5 | Welcome note stops naming deleted themes (issue #271) | starter notes |

Done when: no public page or the README contradicts the product. A grep for "MIT",
"quiet space", "paused for public launch" and the old theme names returns nothing
outside `docs/archive/` and `changelog.ts`.

Should not change: existing accounts' welcome notes. Returning demo visitors keep any
starter they edited.

### Step 2 · Phone and keyboard blockers

Items B1, B2, B3. Days.

| ID | Change | Done when |
|---|---|---|
| B1 | The "More commands" menu on a phone opens inside the screen. It is `position: fixed` inside a `backdrop-filter` ancestor, so it is placed against the toolbar, not the viewport | At 390 by 844 the whole menu is inside the viewport and every command can be tapped · E2E |
| B2 | Dialogs take focus, hold it, make the page behind inert, and return focus on close (issue #257) | Tab from the sign-up dialog never reaches "New note" · component test and E2E |
| B3 | Spring animations honour `prefers-reduced-motion` on touch (issue #258) | No spring runs with reduced motion on · unit test |

Should not fire: the desktop command menu keeps its position. The menu still opens with
the virtual keyboard up (needs the real-device pass, A6, to confirm). Focus is not
trapped by non-modal surfaces: the toolbar, the tag picker, toasts. Escape still closes
each dialog.

### Step 3 · Practice space and small interface fixes

Items B4, B7, B10, B15. Days.

| ID | Change | Done when |
|---|---|---|
| B4 | The sign-up prompt counts only notes the visitor wrote or edited | A visitor who changed nothing is not told "You've written 5 thoughts" · unit test |
| B7 | The practice editor shows "Demo · saved in this browser · not encrypted" while writing | The label is visible in the practice editor and absent for a signed-in account · E2E |
| B10 | "+ Tag" stays on the tag row on a phone | No lone "+ Tag" line at 375px with three tags · visual check |
| B15 | Buttons on shared letters and empty states use the pill radius | Every button on those surfaces computes `--radius-pill` · check the claim first; it is unverified |

Should not fire: the prompt does not appear behind an open dialog or in the editor
mid-sentence. The "not encrypted" label never shows on an encrypted note.

### Step 4 · Editor

Items B12, B8. Days.

| ID | Change | Done when |
|---|---|---|
| B12 | Undo history is per note (roadmap 114). Check the bug exists first; it is unverified | Undo after switching notes cannot alter the previous note · unit test |
| B8 | Focus mode has one visible, quiet entry point outside the command menu | A new visitor can enter focus mode without opening a menu · E2E |

Should not fire: undo within one note still works after an autosave. The focus-mode
control adds no second control to note cards and does not show in the library.

### Step 5 · Landing page

Items D2, D3, D4, D5, D6, D7, D9. Weeks.

- **D2, D3, D4.** A new headline that names writing and privacy together. Shorter
  supporting text. The claim is the writing workflow made private, not encryption
  alone: Standard Notes and Notesnook already offer encrypted notes. The headline
  claims only what the security page backs: titles and content are encrypted; tags,
  dates and sizes are not.
- **D5.** The editor sheet is visible without scrolling on a laptop and starts higher
  on a phone (it starts near y=700 at 390px today).
- **D6.** Each sample note opens that note in the practice space.
- **D7.** One short section for what the page hides: chapters, search, Share as Letter,
  phone and offline use.
- **D9.** A compact FAQ: browsers and installing, what is free and how it is paid for,
  importing, recovery. No "free forever".

Done when: the sheet's top edge is inside the first screen at 1280 by 800 and at 390 by
844; each sample opens its own note; the FAQ answers the four questions.

Constraints: `index.html`'s landing shell mirrors `LandingPage.tsx`, so both change
together. `public/boot.js` and the first-visit budget still hold; the budget check must
pass. No testimonials, counts or press. The headline change ships with its
`DECISIONS.md` entry, the page title, the share text and a redrawn share image
(`scripts/brand/flatten.py`, with the `og:image` version bumped).

Should not fire: a signed-in visitor still goes to the app shell, not the landing page.
The sample links do not create a second copy of a starter the visitor already edited.

### Step 6 · Quick capture

Item E5: roadmap 44, then 47. Blocked on question 3.

### Step 7 · Passkey unlock

Item E1: roadmap 135. Weeks. Its needs (items 24 and 26) have shipped. Measure WebAuthn
PRF support in the target browsers first. The passphrase stays as the fallback. Touches
encryption and auth, so it gets the multi-agent review.

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
