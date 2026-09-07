# Two Reviews, One Plan — Cross-Check of the Claude and Codex Improvement Reviews

**Version:** 1.0
**Last Updated:** 2026-09-07
**Status:** Complete
**Author:** Claude (Claude Code)

---

## Original Prompt

> I asked Codex the same question and it gave me this: Committed as 02d9cc9 on main — docs: record Yidhan product review and improvement roadmap. Review every suggestion, cross check against yours and give me a holistic summary in 3 buckets — common suggestions, what you suggested, what codex suggested and your feedback on each one. Update the visual with this. Again use simple language.

---

> **Execution plan:** every item from this review and the Codex review is sequenced with an ID in [../plans/world-class-execution-plan-claude.md](../plans/world-class-execution-plan-claude.md).

## What was compared

- **Claude review:** `docs/analysis/world-class-improvements-claude.md` and the visual brief `docs/analysis/world-class-improvements-visual-claude.html` (2026-09-06).
- **Codex review:** `.impeccable/critique/2026-09-06T20-15-28Z__src-app-tsx.md`, commit `613da6d` on `main` (2026-09-06).

Every Codex claim about the code was checked against the source before I gave feedback. Where I write **verified**, I read the lines and they say what Codex says. One competitor claim, that Bear now has a web app, was checked by web search and confirmed.

**The short version.** The two reviews agree on most of the big moves. Codex is stronger on *trust while writing*: it found that a failed save is ignored when you leave a note, that typing without pause never saves, and that the Practice Space promises encryption it does not have. I am stronger on *what actually happens when you use the app*: the keystroke bugs, the tag that never syncs, the blank conflict screen, the phone's first minute, and the 1 MB front page. Put together, the plan gets better, not longer.

---

## Bucket 1: We both said this

| # | Suggestion | Who had the sharper version | My feedback |
|---|------------|-----------------------------|-------------|
| 1 | A spare key you keep, and the ability to change your passphrase, using a wrapped vault key so notes are not re-encrypted | Claude has the mechanism; Codex adds that old offline devices and backups need a versioned migration plan, and that issue #170 is filed as P3 | Agree on both. Raise #170 to P1. Do it before any public "private" campaign. |
| 2 | Pictures in notes, encrypted before upload | Codex adds PDFs, thumbnails, resumable upload, quotas, cleanup, "an upload button is not a feature" | Agree. Images first, PDFs second, everything else after. |
| 3 | A web address for every note, browser Back that works, a quick switcher | Same | Agree. This unlocks note links, capture shortcuts, and iOS widgets. |
| 4 | Simple links between notes, no graph view | Same; both revisit the "no backlinks" decision | Agree. |
| 5 | Simple tables, no databases | Same; both revisit the "no tables" decision | Agree. |
| 6 | Find in note and word count | Codex adds find *and replace*, an outline, folding, footnotes | Find, replace, count, outline: yes. Folding and footnotes: later. |
| 7 | Search that scales: cache the plain text, add an index, ranking, date and tag filters, keyboard selection | Codex adds a worker, saved searches, and virtualised results | Agree. Saved searches are a good fit. Codex is also right that the cost is HTML parsing, not decryption. |
| 8 | Encrypt tag names | Same | Agree. Tags are the one thing on the server that says something about a person. |
| 9 | An encrypted backup that restores in a fresh browser | Codex adds "test the restore, a download is not proof" | Agree. Add a restore test to CI. |
| 10 | Import from Markdown folders, Bear, Notion, Apple Notes | Codex adds a preview before import and counts after, and a real parser instead of regular expressions | Agree on all three. |
| 11 | One broken note must not hide the whole library | Same | Agree. Show it as a locked card. |
| 12 | Split `App.tsx` and `Editor.tsx` | Codex: "size alone is not a defect, but change risk grows" | Agree. Split when touching, as Codex says. |
| 13 | Run the real signed-in browser journeys in CI, and test on real phones | Same | Agree. Only the service-worker suite runs today. |
| 14 | Load cost: dynamic imports that do nothing because the module is also imported statically | Claude has the landing weight (1 MB); Codex has the build warnings | Both verified. The build reports five such modules. Fix both. |
| 15 | One set of commands across sidebar, toolbar, mobile bar, slash menu | Codex sharper: at 1100 px and wider the full toolbar is hidden and the sidebar shows 10 of 16 commands | Verified. On a wide desktop, underline, strike, numbered list, divider, and undo have no button. Fix in the same pass as the link button. |
| 16 | Keep the architecture. No rewrite, no early native rewrite | Same | Agree. |
| 17 | Keep the visual identity, the voice, and the calm | Same | Agree. |
| 18 | Defer publishing, collaboration, databases, graph view, cloud AI | Same | Agree. |

---

## Bucket 2: Only I said this

Most of these came from running the built app and pressing keys. Codex looked at the code and the screens but did fewer scripted interactions, and its own evidence section says so.

| # | Suggestion | Why it matters |
|---|------------|----------------|
| 1 | Enter in the title stays in the title (verified bug) | The first thing a writer does. |
| 2 | Esc on the slash menu closes the whole note (verified bug) | Loses your place mid-thought. |
| 3 | Links have no button, and clicking one inside the editor leaves the app | Table stakes in every rival. |
| 4 | Pasted markdown stays as symbols | Bear and Craft users paste markdown daily. |
| 5 | Tags added on one device never reach another until a full reload | The biggest correctness gap in sync. Codex did not find it. |
| 6 | The conflict screen shows two blank cards | You choose between versions you cannot see. |
| 7 | Sync scans every note and tag on every run, and builds the cursor with a spread that fails past tens of thousands of notes | Scale. |
| 8 | Markdown export loses highlights, underline, and alignment; the full backup file cannot be imported back | Portability that is actually lossy. |
| 9 | The phone's first minute: a pop-up before the notes, the ribbon over the footer, the title shown twice, `h-screen` instead of `100dvh` | First impression on mobile. |
| 10 | Make the front page static and under 50 KB; lazy-load Supabase, Argon2, and Sentry replay; fix the React chunk | An award-winning page should feel instant. |
| 11 | A list view, sort by created or edited, bulk actions in list view | The library past a few hundred notes. |
| 12 | Smart quotes and dashes, spellcheck and language attributes, code block languages | Craft details for a writing app. |
| 13 | Keyboard navigation over cards, templates and a daily page, `#tag` autocomplete | Speed for daily writers. |
| 14 | Editor polish: the page should grow with content, the lone pinned note, title size, card-to-page transition, reading settings, the two hidden themes | Award-level polish. |
| 15 | Build the iPhone app now with Face ID unlock; widgets and share extension after | Codex says validate the shell first. The Android shell already proves it. Test the keyboard in week one and go. |
| 16 | Passkey unlock on the web, a public threat-model page, `security.txt` | Earn the word "private". |
| 17 | A passphrase on a shared letter; refresh a letter without a new link | Small, and the safest way to share a lease or a medical note. |
| 18 | Small bugs: blank notes pile up, undo history crosses notes, duplicate Underline extension, slash menu opens off-screen, toolbar state goes stale | Housekeeping. |

---

## Bucket 3: Only Codex said this, with my feedback

| # | Codex suggestion | Verified? | My feedback |
|---|------------------|-----------|-------------|
| 1 | **A failed save is ignored when you leave.** Esc and the logo save and then leave even if the save failed. The error hides after five seconds and sits in a header that fades in focus mode. | Yes: `src/components/Editor.tsx:505-518, 680-690`, error timeout at `:418-421`, header is `.focus-mode-target` at `:1125` | **Agree, P0.** The best single catch in either review. Exit paths must check the result. Keep a small "Not saved" state on screen until it is fixed, with Retry and Copy. Show it in focus mode too. |
| 2 | **Typing without pause never saves.** The 800 ms timer resets on every keystroke; there is no upper bound. | Yes: `src/components/Editor.tsx:432-451` | **Agree, small.** Also save at most every ten seconds while typing. |
| 3 | "Saved" means saved on this device, not synced. Say which. | Yes | **Agree, small.** "Saved here" then "Synced", quietly. |
| 4 | **Encrypted revision history per note**, with preview, restore, and save-as-copy. Faded Notes protects deleted notes, not a replaced paragraph. | Yes: no revision store in `src/lib/offlineDb.ts` | **Agree, medium.** Keep the last 20 snapshots or 7 days locally first. Sync them later. Apple Notes, Craft, and Notion all have history. |
| 5 | **A window between checking and writing on the server.** The update reads the row, checks the hash, then updates by id. Another device can write in between. The "is syncing" guard is per tab, not per browser. | Yes: `src/services/syncEngine.ts:587-640`, guard at `:82` | **Agree, small.** Add `where content_hash = expected` to the update so the server rejects stale writes. Use the Web Locks API so two tabs do not both sync. Codex is right that this beats a CRDT for now. |
| 6 | **The Practice Space claims encryption it does not have.** The starter note says "end-to-end encrypted" while demo notes are plain JSON in localStorage. The landing seal says "Locked before it leaves your hands" while the draft is plain text in localStorage. | Yes: `src/services/demoStorage.ts:59, 169`, `src/components/LandingPage.tsx:279` | **Agree, P0 copy fix.** "This is a practice space. Nothing here is locked yet. Sign up to lock it." One sentence, no code. |
| 7 | **Shared text arrives through the URL.** The share target uses GET, so title and text ride in the address bar and are staged in localStorage. | Yes: `vite.config.ts:90-98`, `src/hooks/useShareTarget.ts:79-88` | **Agree in principle, medium.** The real fix is a POST target handled by the service worker, which needs a locked-vault design. Do it with the iOS share extension. Until then, scrub the address bar immediately. |
| 8 | **An independent security review** before broad public assurances. | n/a | **Agree.** Budget it. Pair it with the threat-model page. |
| 9 | Outline, heading folding, footnotes, print and PDF output, DOCX. | n/a | Outline: yes, P2. A print stylesheet: yes, small and cheap. Folding, footnotes, DOCX: later. |
| 10 | Named collections or saved views, "without a mandatory sidebar". | n/a | **Careful.** Collections drift into folders. Try saved searches first; they give most of the value with no new concept. |
| 11 | Append-to-existing-note capture, and a browser clipper later. | n/a | Append to today's page fits the daily-page idea. Clipper much later. |
| 12 | Local OCR for images and PDFs. | n/a | Later. Heavy. Images first. |
| 13 | The card preview always fades its last lines, even when nothing is cut off. Older notes fade with age. | Yes: `src/index.css:917-926`, `src/components/ChapterSection.tsx:28-35` | Mask: **agree**, fade only when text overflows. Age fade: keep a lighter version. It is part of the identity, but 0.80 on the Archive chapter hurts reading. Cap at 0.9. |
| 14 | A stale E2E test still expects "never expires" shares. | Yes: `e2e/sharing.spec.ts:41-54` | **Agree.** Delete it. |
| 15 | Measurable targets: unlock to editable under 1 s, keystroke under 100 ms, search under 200 ms at 10,000 notes, cross-device under 5 s, zero lost acknowledged edits. | n/a | **Adopt as acceptance targets.** Better than my success measures. |
| 16 | Try the app with 8 to 12 real writers for a few weeks before the big bets. "An award is an outcome, not a criterion." | n/a | **Agree.** Cheap and important. |
| 17 | Test willingness to pay before promising unlimited attachments and backups. | n/a | **Agree.** Supabase free storage is 1 GB. The Bloom tier plan already exists. |
| 18 | Notesnook is the closest real rival: encrypted, works in the browser, has attachments, import, and a recovery key. | n/a | **Agree, and I missed it.** Added to the scorecard. |
| 19 | Bear now has browser access; do not claim it has no web app. | **Yes.** Bear Web has been in public beta since July 2025: browse, edit, and search from any browser. Encryption is still in the works. | Codex is right and my scorecard was stale. Bear's browser cell changed from "none" to "okay". |
| 20 | Apple Notes can be end-to-end encrypted with Advanced Data Protection. | Yes | I already had this as "opt-in". No change. |
| 21 | Move the editor to a versioned JSON document format gradually, without replacing the editor. | n/a | **Agree.** ProseMirror JSON behind the same sanitizer. Do it when pictures land. |
| 22 | Automate migration order and drift checks so the app never ships ahead of its database. | n/a | **Agree.** `verify_migration_state.sql` exists but is run by hand. A CI step against a staging database would do it. |
| 23 | A design-heuristics score of 25 out of 40, with two P1s: honest privacy language and a persistent failure state. | n/a | Fair. I would put my two keystroke bugs above them, but the two P1s are right. |

### Where we differ, and how I resolve it

- **Order.** Codex puts trust (save, recover, precondition) first and editor fluency second. I put the keystroke bugs first. Both sets are small, so the revised first phase does both.
- **iOS.** Codex wants to validate the Capacitor shell before committing. The Android shell already runs the same code. I say start the iOS project now and test the keyboard in week one.
- **Search.** Codex says the app does not need to "stop decrypting on every keystroke". Correct. The cost is parsing HTML per keystroke, and we agree on caching the plain text.

---

## The plan, revised

> Superseded on 2026-09-07 by `docs/plans/world-class-execution-plan-claude.md` version 2.0, a plain-numbered Now / Next / Later / Done list that withdraws the calendar labels below and folds in the Codex plan review.

| Phase | Length | What changed after the cross-check |
|-------|--------|------------------------------------|
| 0. Fix the snags | 2 to 3 weeks | **Added from Codex:** honest save failure on every exit path, a ten-second maximum save interval, "saved here" versus "synced", the server-side write precondition, the Practice Space and landing copy fix, delete the stale share test. **Kept from Claude:** Enter, Esc, link button, blank conflict screen, tag sync, gesture pop-up, ribbon, lossy export. |
| 1. Table stakes | 6 to 8 weeks | **Added:** bounded local revision history, cross-tab sync lock, print stylesheet, acceptance targets measured in CI. **Kept:** spare key and passphrase change, note addresses and quick switcher, list view and smart search, static front page, `App.tsx` split. Run the 8 to 12 writer cohort during this phase. |
| 2. Depth | 8 to 12 weeks | **Added:** outline, PDFs as attachments, share target redesign with the share extension, independent security review before the "private" campaign. **Kept:** pictures, importers with preview and counts, encrypted tags, note links, the iPhone app with Face ID. |
| 3. Distinction | ongoing | Unchanged: simple tables, passkeys, widgets, public garden, folding and footnotes, OCR. |

---

## Corrections to my own review

- Added Notesnook to the competitor set.
- Changed Bear's browser access from "none" to "okay": Bear Web is in public beta.
- Added five Codex findings I had not found: save failure ignored on exit, no maximum save interval, the server-side check-then-write window, the Practice Space encryption claim, and the hidden desktop toolbar at 1100 px and wider.
