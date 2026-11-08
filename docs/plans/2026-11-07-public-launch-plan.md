Status: ACTIVE
Last verified: 2026-11-08

# Public launch plan

What is committed for the public launch, in order. Nothing else.

This replaces `world-class-execution-plan-claude.md`, which flipped to SUPERSEDED in
the same commit. Its two unfinished items (153 and 87) carry over below unchanged.
Its lookup table from old IDs to ledger numbers stays in that file.

The review that produced this plan is published as a page in the app's own design
system; the lists below are the same lists. The reasoning behind the order is in
`DECISIONS.md` (2026-11-07).

## How to read this

- **Item.** One thing to do, with its ledger number and the area it touches. Numbers
  154 and up are new; everything else kept its number from `docs/roadmap.md`.
- **Now** holds the launch blockers, in two lanes. They were moved out of
  `docs/roadmap.md` in the commit that created this plan, with their "done when"
  intact. Launch means announcing publicly; nothing in **Now** may be skipped for it.
- **Next** holds the launch story: the features to build once the door is open, in
  build order. **They are not promoted.** They stay on `docs/roadmap.md`, which owns
  their "done when", until each moves into **Now**. Listing them here records the
  order, not approval.
- **PR.** A pull request closes one or more items and names them in its title:
  `Fix items 154 and 155: licence, page titles`.

Effort is **days** (under a week), **weeks** (one to three), or **a month or more**.
"Needs" names items that must land first.

---

## Gates that jump the queue

Two open issues can lose words or leak metadata. Both are bugs, so they live in the
issue tracker, not here, but neither may be open on launch day:

- **#205** — a delete from another device discards an open draft that failed to save.
  Anything that can lose words goes first; this is first.
- **#207** — `note_tags` realtime RLS has not been confirmed with a two-account test.
  Run it before strangers share a database.

---

## Now

### Lane 1 · Keep the promises

The landing page says "nothing to set up", "free and open source" and "not even us".
Each of these is ahead of the product. This lane closes the gap.

| # | Area | Item | Effort | Needs / start when | Done when |
|---|------|------|--------|--------------------|-----------|
| 156 | Landing | The hero states only what the security page can back. Until item 104 (independent review) has a report, the hero's privacy line uses the security page's own wording and links to it. "Nothing to set up" is qualified so it reads as applying to trying the app, since an account needs a passphrase. In the same pass, the hero's editor picture shows five toolbar labels, not sixteen, and never greyed-out Undo and Redo; and `/support` gains one plain paragraph on how a free service run by one person is maintained and what support to expect | days |  | `index.html` shell and `LandingPage.tsx` carry the same copy (both change together); the picture's toolbar lists at most five labels · `LandingPage.test.tsx` and the shell copy check |

### Lane 2 · Survive launch day

| # | Area | Item | Effort | Needs / start when | Done when |
|---|------|------|--------|--------------------|-----------|
| 86 | Auth | Custom SMTP for auth email on the custom domain (SPF, DKIM, DMARC); magic-link sign-in; the auth email rate limit raised to what the sender allows; a new account can write locally before the confirmation email arrives and syncs once it does | weeks | Needs #157 (the sender needs a domain you own). Maintainer provisions the sender | OTP and magic-link emails arrive within one minute in production for 50 consecutive sends; a sign-up whose confirmation is delayed can still create and edit a note, and that note syncs after confirmation without a second save · manual verification log and E2E |
| 61 | Speed | First-visit weight, steps 1 to 7 of `2026-11-07-first-visit-weight-proposal.md` in the order 1, 3, 6, 4, 2, 5, 7: trim the precache; lazy-load the changelog; register the service worker after `load`; fix the React chunk and the six import warnings; defer Sentry with a pre-init error buffer and Replay by `import()` from our bundle; split the public routes from the app shell and load Supabase only on a session, an auth callback or sign-in; load `hash-wasm` inside `deriveKey`. Fonts stay fully precached (the proposal's step 8 was declined) | weeks | The proposal carries the measurements, the risk per step and the CI assertion per step | The six targets in the proposal's Targets table hold, each asserted in CI: JS requested on `/` before `load` at most 90 KB gzip; everything `/` requests until network idle at most 300 KB gzip excluding the precache; JS to render the unlocked library, Editor excluded, at most 330 KB gzip; largest chunk at most 150 KB gzip; precache at most 1,100 KB with no URL twice; the first precache request after `load`. Asserted by `scripts/check-bundle-budget.mjs` in `npm run build` with a dummy `VITE_SENTRY_DSN`, `e2e-sw/first-visit.spec.ts`, and a Rollup `onwarn` that fails the build on the static-plus-dynamic warning. Closes with one Lighthouse run against the Vercel preview recorded in `docs/progress.md` |
| 60 | Speed | Public routes other than `/` readable with JavaScript disabled: `/privacy`, `/terms`, `/support`, `/changelog`, `/roadmap`, `/security`. Whether that is a prerender or a static shell per route is decided when this starts, against `DECISIONS.md` 2026-09-10 | weeks | Start after #61; with #61 done, `/` meets its budget without a prerender | Each listed route shows its content with JavaScript disabled; `/` keeps its #61 budget · E2E per route and the #61 budget script |
| 81 | Testing | Cross-browser matrix: Chrome, Edge, Firefox, Safari; real iPhone, iPad, Android; installed PWA | days | Needs a real iPhone for an afternoon | Matrix documented; the release checklist records a pass per release; the outstanding iOS Safari toolbar check from item 83 is recorded as passed or filed · checklist |
| 85 | Testing | Real-device testing checklist per release (keyboards, installed PWA, gestures) | days | Needs #81 | A release cannot merge without a recorded device pass · checklist in repo, referenced from the release PR template |
| 153 | Testing | Verify the "done when" tests for items 6, 8, and 18 (killed-tab recovery, cross-device latency, authenticated backup restore); closes #210 | days | Item 37 shipped the fixture and the CI job. Still needs the maintainer to provision the test account and add the five repository secrets, or the authenticated tests skip. | Each of the three tests runs in CI and passes; a later `docs/progress.md` entry corrects the #201, #202, #204 entries · CI log |
| 160 | Design | Accessibility pass on the rendered app before launch: axe through Playwright on the landing, library, editor, unlock, setup and settings screens, at 100% and 200% zoom, with `prefers-reduced-motion` on; every violation fixed or filed with a reason. The CI version is roadmap item 67 | days |  | Zero axe violations on the six screens in both themes at both zoom levels; reduced motion leaves no animation running · the spec in `e2e/`, run once and its result recorded in `docs/progress.md` |

### Maintainer

Blocked on the maintainer, not on code.

| # | Area | Item | Effort | Needs / start when | Done when |
|---|------|------|--------|--------------------|-----------|
| 157 | Operations | Custom domain in place of `yidhan.vercel.app`, with Supabase Site URL and Redirect URLs updated; Supabase project on a plan that does not pause when idle and whose monthly-user cap exceeds the launch forecast; the launch-day forecast written down | days |  | OAuth and magic links work on the new domain; the plan and the forecast are recorded in `docs/setup/` · manual check |
| 87 | Process | Validation cohort: 8 to 12 target writers for several weeks with their own material and consent for content-free diagnostics; observe capture-to-save, finding an old note, long writing, interruptions, migration, restoration | ongoing | Needs items 1 to 22 shipped | Findings written up and used to reorder `docs/roadmap.md` · doc in `docs/plans/` |

---

## Next · The launch story

Not promoted. Each stays on `docs/roadmap.md` until it moves into **Now**. The order
is the recommendation; a real writer or a measurement may change it.

Everything here runs on the device only, so the server stays ignorant.

| Order | Lane | Items | What the writer gets |
|---|---|---|---|
| 1 | Keys | 135 | Passkey unlock on the web. Touch the sensor, the vault opens. Start when #24 and #26 have shipped |
| 2 | Capture | 44, then 47, then 94 and 96 | A "New note" home-screen shortcut; a share target that encrypts on arrival; append to today's page |
| 3 | Saving | 58, then 59 | A per-note history panel: see earlier versions, bring one back. Local first; sync (#118) later |
| 4 | Navigation | 42, then 92 | Any note in three keystrokes; note links on the same switcher |
| 5 | Library | 161 (Return to a thought), then — (Quiet Intelligence) | "Return to a thought": from an older note, "Add a reflection" creates a dated companion note and keeps the original; related notes on request from the in-memory index. Then "On this day": one card at the top of the library from a year ago today. No server, no notification |
| 6 | Sharing | 122, then 123 | Optional passphrase on a letter; refresh a letter under the same link. Then the landing page talks about letters |
| 7 | Design | 109 | Reading settings: text size, line length, Washi and Mori |
| 8 | Import | 78, then 89, then 90 | A real Markdown parser; Apple Notes, Bear and Obsidian importers; a preview of what carries over |

Two things people will ask for on day one and should be told are coming, not built
first: images in notes (items 32 to 34) and a paid tier (item 126).

---

## Working rules

- Work from **Now**. Anything that risks losing or leaking words jumps the queue.
- A PR closes items. Its title names them. The same PR removes them from this file,
  adds a line to `src/data/changelog.ts`, and appends to `docs/progress.md`.
- The "done when" is the test. It ships in the same PR as the item, never later.
- Anything needing a database change ships with the migration guard (#36) and
  `verify_migration_state.sql` run against the deployment target.
- `npm run check` on every PR. `npm run e2e` runs in CI on every PR (item 37), so run it
  locally only for the spec covering a flow you changed.
- When a real writer or a measurement says the order is wrong, change the order.
  Nothing else reorders it.
- The plan holds planned work. GitHub issues hold bugs and loose ends discovered while
  shipping. Nothing lives in both; an item whose "done when" was never verified stays in **Now**.
- Permanent non-goals live in `PRODUCT.md`, not here.
