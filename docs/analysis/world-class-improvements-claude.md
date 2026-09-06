# Yidhan: From Beautiful to World-Class — Improvement Analysis

**Version:** 1.0
**Last Updated:** 2026-09-06
**Status:** Living Document
**Author:** Claude (Claude Code)

---

## Original Prompt

> Look at Yidhan's features and codebase and suggest improvements to make this a world class note taking and writing app that can rival apple notes, notion, bear, craft, and other note taking applications. My original objectives still remain — browser based cross platform first, Apple iOS app later, full privacy, award winning ui design and seamless ux that just works.

---

## How this was produced

This analysis is grounded in the code as of v3.19.8 (commit `c7b6bbe`), not in the marketing copy:

- Four targeted code audits (editor, library/navigation, data/sync/crypto/export, prior strategy docs), each with `file:line` evidence.
- A production build with placeholder credentials to measure real bundle sizes.
- Screenshots of the landing page, Practice Space, editor, search, tag modal, and mobile views in both themes, captured in headless Chromium against the built app.
- Scripted interaction checks in the Practice Space: markdown input rules, markdown paste, `Enter` in the title, `Escape` with the slash menu open.
- A read of every open strategy and backlog document so this builds on prior decisions instead of repeating them. See `docs/roadmap.md`, `docs/backlog.md`, `docs/active/strategic-viability-review-claude.md`, `docs/analysis/launch-readiness-review-claude.md`.

Where a finding was verified by running the app it is marked **(verified)**. Everything else cites the code.

---

## 1. Executive summary

Yidhan already owns the two things that cannot be bought later: a coherent, distinctive visual identity, and a genuinely zero-knowledge architecture that fails closed on plaintext. Nothing in the Apple Notes / Bear / Craft / Notion set has both. That is the moat, and the prior strategy docs are right to protect it.

What stands between "beautiful" and "world-class" is not more features. It is three kinds of depth:

1. **Depth of the writing surface.** Links have no UI, images do not exist, markdown paste is not converted, `Enter` in the title does not move to the body, and `Escape` on the slash menu exits the note. A writer feels these within the first five minutes. Bear, Craft, and Apple Notes get all of them right.
2. **Organization that survives 500 notes.** The library is one masonry grid, one fixed sort, flat tags, and substring search that re-parses every note's HTML on each keystroke. There is no list view, no note URL, no quick switcher, no way to sort by creation date, and no bulk action. Temporal chapters are a lovely idea for 40 notes and an unsolved problem at 2,000.
3. **Durability a person can trust with ten years of journals.** A forgotten passphrase is terminal, the passphrase cannot be changed, exports are plaintext only, the conflict dialog shows two blank cards, and tag assignments made on another device never arrive until the next full hydration. Privacy is the promise; recoverability and correctness are what make the promise believable.

The ten moves below deliver those three kinds of depth while preserving the quiet. They are ordered by leverage, not by ease.

| # | Move | Why it matters | Effort |
|---|------|----------------|--------|
| 1 | Recovery kit and a wrapped master key (passphrase change without re-encrypting) | Turns "cannot be recovered" into a first-class trust feature; unblocks passphrase rotation | M |
| 2 | Encrypted image attachments | Highest-consensus gap across every prior doc; table stakes for all four competitors | L |
| 3 | Links, markdown paste, title `Enter`, `Escape` fix | The daily-feel bugs; each is small, together they change how the editor feels | S |
| 4 | Note URLs, browser back, and a quick switcher | Deep links are the foundation for links-between-notes, share targets, Spotlight, and widgets | M |
| 5 | List view, sort options, search operators, memoized search | Makes the library work past a few hundred notes without adding folders | M |
| 6 | Fix the three sync correctness bugs (blank conflict modal, `note_tags` never pulled, stale-hash `Math.max`) | "Just works" is only true if these are fixed | S |
| 7 | Importers (Apple Notes, Bear, Notion, Evernote, Obsidian), lossless Markdown, encrypted backup | Lowers switching cost; every rival has a one-click path in | M |
| 8 | Bundle diet and a prerendered landing page | The landing page ships 1 MB of JavaScript before the first word; an award-winning page should feel instant | M |
| 9 | Mobile first-run fixes and the iOS Capacitor path with biometric unlock | Removes the interstitial, the ribbon overlap, the doubled title; sets up the App Store step | M then L |
| 10 | Split `App.tsx` and add a route table | 2,668 lines with 31 state variables is the tax on every move above | M |

Effort: S under one week, M one to three weeks, L three to six weeks, XL longer.

---

## 2. Competitive scorecard

Ratings are relative to the target user (reflective writer, minimalist professional), not to power users. "Strong" means a competitor's users would notice its absence.

| Dimension | Yidhan | Apple Notes | Bear | Craft | Notion |
|-----------|--------|-------------|------|-------|--------|
| Visual identity and typography | Strong, distinctive | Adequate | Strong | Strong | Adequate |
| Rich-text basics (bold, lists, tasks, quotes, code) | Adequate | Strong | Strong | Strong | Strong |
| Links (insert, edit, preview) | Missing UI | Strong | Strong | Strong | Strong |
| Images and attachments | Missing | Strong | Strong | Strong | Strong |
| Simple tables | Missing (decided against) | Strong | Strong | Strong | Strong |
| Markdown fluency (shortcuts and paste) | Partial | Weak | Strong | Strong | Strong |
| Organization at scale (views, sort, hierarchy) | Gap | Strong | Strong | Strong | Strong |
| Search (ranking, operators, in-note find) | Basic | Strong | Strong | Strong | Adequate |
| Note-to-note links | Missing | Strong | Strong | Strong | Strong |
| Quick capture and command palette | Missing | Strong | Strong | Strong | Strong |
| Offline-first with sync | Strong | Strong | Strong | Strong | Weak |
| Zero-knowledge encryption | Strong, best in class | Opt-in (ADP) | None | None | None |
| Key recovery and rotation | Gap | Strong | n/a | n/a | n/a |
| Browser-first, cross-platform | Strong | Weak | None | Adequate | Strong |
| Sharing and publishing | Adequate (E2EE letters) | Adequate | Basic | Strong | Strong |
| Import and export | Adequate, lossy | Weak | Strong | Strong | Adequate |
| Mobile native feel | Adequate (PWA, Android WebView) | Strong | Strong | Strong | Adequate |
| First-load performance | Gap (1 MB JS) | n/a | n/a | Adequate | Weak |

Read across the rows: Yidhan is the only entry that is Strong on privacy, offline, and browser-first at once. It is the only entry Missing on links, images, note links, and quick capture. The job is to close the second set without diluting the first.

---

## 3. What is already excellent (keep it)

Naming these matters because every recommendation below should be tested against them.

- **The landing page.** A single line, one CTA, no feature grid. It is the calmest landing page in the category and it says what the product is. **(verified by screenshot)**
- **The library's material feel.** Card stock, asymmetric corners, warm shadows, chapter headers as landmarks. Light and dark are both convincing. **(verified)**
- **The editor's manuscript surface.** Viewport-following glow, the vertical sidebar toolbar, the title zone with hover-revealed timestamps, "· · ·" divider, "Return to notes". These are craft details rivals skip.
- **The encryption posture.** AAD-bound AES-GCM, HMAC content hashing for conflicts, fail-closed plaintext rejection on every read path, database CHECK constraints, ciphertext-only share RPC. `src/lib/encryption.ts`, `supabase/migrations/launch_security_hardening.sql`.
- **Sync resilience.** Blocked-state recovery, batched queue with barriers, server-authoritative timestamps, storage persistence request. `src/services/syncEngine.ts`.
- **Voice.** "Faded Notes", "Let this note fade?", "Letting Go", "Share as Letter". Nobody else sounds like this.
- **Engineering discipline.** Roughly 1,000 unit tests, 76 E2E tests, coverage gates, a real service-worker update test, react-doctor at 100.

---

## 4. Findings and recommendations by area

Each subsection gives the current state with evidence, the gap, and a recommendation with effort. Priorities: **P0** fix now, **P1** next quarter, **P2** after that, **P3** exploratory.

### 4.1 The writing surface (editor)

**Current state.** Tiptap StarterKit with H1–H3, underline, text-align, single-colour highlight, task lists, and a 13-item slash menu (`src/components/RichTextEditor.tsx:84-107`, `src/components/SlashCommand.tsx:98-221`). Markdown input rules work for headings, lists, quotes, code fences, bold, italic, strike, `[ ]`, and `==highlight==`. The stored HTML is sanitized on every write path to a fixed allow-list (`src/utils/sanitize.ts:57-83`), which is also the hard boundary of what any new feature can persist.

**Gaps, in the order a writer meets them.**

| Finding | Evidence | Priority |
|---------|----------|----------|
| `Enter` in the title stays in the title. The handler swallows the key and the comment claims focus moves to the body; it does not. | `src/components/Editor.tsx:95-100` **(verified)** | P0 |
| `Escape` with the slash menu open saves and exits the note. The window-level handler does not check `defaultPrevented` or any open popover. | `src/components/Editor.tsx:505-518`, `src/components/SlashCommand.tsx:312-320` **(verified)** | P0 |
| Links exist via StarterKit but have no insert, edit, or remove UI; `openOnClick` defaults on, so clicking a link inside the editor navigates the tab away. `Cmd+K` is taken by search. | `src/components/RichTextEditor.tsx:84`, `src/components/Editor.tsx:529-544` | P0 |
| Pasting markdown text inserts it literally; `## Heading` stays `## Heading`. `markdownToHtml` exists but is only wired to file import. | `src/utils/exportImport.ts:416-489`, no `handlePaste` anywhere **(verified)** | P1 |
| No images or attachments of any kind; `img` is stripped by the sanitizer. | `src/utils/sanitize.ts:57-83`, `src/data/roadmap.ts:31` | P1 |
| Toolbar and sidebar active states go stale on selection-only moves because only `RichTextEditor` subscribes to transactions. | `src/components/EditorToolbar.tsx`, `src/components/EditorSidebar.tsx` | P1 |
| No word or character count, no reading time, no find-in-note. | `@tiptap/extension-character-count` not installed | P1 |
| No smart typography (quotes, dashes, ellipsis). For a serif writing app this is the detail that reads as "crafted". | `@tiptap/extension-typography` not installed | P1 |
| No `spellcheck` or `lang` attribute on the editor; only `class: 'prose-editor'` is set, and that class has no CSS. | `src/components/RichTextEditor.tsx:118-122` | P2 |
| Code blocks have no language or highlighting. | no lowlight | P2 |
| `TextAlign` is loaded but has no UI; reachable only by hidden shortcuts. Inline `code` has no button. | `src/components/RichTextEditor.tsx:96-98` | P2 |
| Undo history leaks across notes: `setContent` on note switch is called without suppressing history. | `src/components/RichTextEditor.tsx:205` vs `Editor.tsx:232, 636` | P2 |
| Empty notes accumulate: "New note" creates immediately and nothing removes an untouched blank on back-navigation. | `src/App.tsx:1230-1247` | P2 |
| Mobile: slash menu is a raw `document.body` div with no flip or clamp, so it opens off-screen near the bottom. Triple-tap for focus mode competes with the OS select-paragraph gesture. | `src/components/SlashCommand.tsx:279-309`, `Editor.tsx:774-804` | P2 |
| Duplicate `Underline` registration (StarterKit 3.x already includes it) triggers a Tiptap warning. | `src/components/RichTextEditor.tsx:95` | P3 |

**Recommendations.**

1. **Fix the two keystroke bugs first (S).** `Enter` in the title should focus the body at position 0 (Bear, Craft, Apple Notes all do this). The `Escape` handler should return early if `e.defaultPrevented` or if any popover (slash menu, delete confirm, share, export) is open, and the slash menu should call `preventDefault`.
2. **Links, properly (S).** Configure `Link` with `openOnClick: false`, add a small link popover (URL field, open, remove) that appears when the caret is inside a link, and add "Link" to the toolbar, sidebar, and slash menu. Inside the editor with a selection, `Cmd+K` should mean link; move library search to `Cmd+Shift+K` only, or make `Cmd+K` open the command palette described in 4.2. Paste-over-selection with a URL should linkify the selection (Bear and Notion behaviour).
3. **Markdown paste (S).** Add `editorProps.handlePaste`: if the clipboard has no `text/html` and the plain text looks like markdown (heading, list, or link syntax on at least one line), run it through `markdownToHtml` and insert the result. Keep the existing sanitizer in the path.
4. **Typography and counts (S).** Add the Typography extension and CharacterCount. Show the count in the title-zone metadata row (where the timestamp already lives), hover-revealed on desktop like the timestamp, so it costs no visual weight.
5. **Find in note (S).** `Cmd+F` inside the editor opens a slim inline search with next/previous and match highlighting via a ProseMirror decoration plugin. Do not take over the browser's find unless the editor is focused.
6. **Encrypted images (L).** See 4.6 for the storage design. In the editor: paste, drop, and a slash command; images render from local blob URLs; the sanitizer allows `img` only with a `data-attachment-id` attribute and no external `src`. Cap at 5 MB per image, downscale to 2048 px client-side before encrypting. Ship images before any other block type.
7. **Live toolbar state (S).** Subscribe `Editor` to `editor.on('selectionUpdate')` and `'transaction'` with a cheap version counter so `isActive` reads are fresh.
8. **Reconsider simple tables (P2, M).** The "Not Building" list rejects databases and tables as Notion's game. Databases, yes. But a three-column table for a packing list or a reading log is Apple Notes territory, not Notion's. The Tiptap Table extension with no formulas, no sorting, and no column types stays inside the quiet. Recommend revisiting after images ship.

### 4.2 Capture and navigation

**Current state.** No router. Views are a `ViewMode` union plus three booleans held in `App.tsx`, rendered by a waterfall of early returns (`src/App.tsx:2036-2665`). Library and editor both map to `/`; opening a note sets state without a history entry, so browser Back from the editor leaves the app (`src/App.tsx:1205-1212`, `413-423`). Note identity survives refresh only through `sessionStorage` (`src/App.tsx:744-779`). The Faded Notes view is not routeable and the URL-sync effect actively rewrites its path to `/`. Keyboard: `Cmd+N`, `Cmd+K` (search), `?`, `Escape`, `Cmd+Shift+F`, `Cmd+Shift+C`. No arrow-key navigation over cards, no shortcut for pin, tag, faded, settings, theme, or lock.

**Why it matters.** Every rival gives a note an address. Apple Notes has note links and Spotlight, Bear has `bear://` and wiki-links, Craft has deep links and a `Cmd+O` switcher, Notion has URLs and `Cmd+P`. Without a URL there can be no note-to-note link, no "copy link to this note", no share-target landing on a specific note, no Spotlight or widget target on iOS later.

**Recommendations.**

1. **Give every note a URL (M, P0).** `/n/<noteId>` for the editor, `/faded` for Faded Notes, `/` for the library. Push history on open, pop on back, restore scroll on return. Extract routing into `src/routing/` with a small route table and `navigate`/`useRoute` helpers; a library is optional but a single module is not. This is also the first step of splitting `App.tsx` (4.10).
2. **Quick switcher and command palette (M, P1).** Grow the existing search field into a palette: `Cmd+K` in the library focuses it as today; typing filters notes with arrow-key navigation and `Enter` to open; a leading `>` lists actions (New note, Pin, Add tag, Lock vault, Toggle theme, Faded Notes, Settings, Export). `Cmd+P` opens the same palette from anywhere, including inside the editor. One surface, no new chrome, discoverable through the existing `?` modal.
3. **Keyboard-navigable library (S, P1).** `j`/`k` or arrows to move focus between cards, `Enter` to open, `p` to pin, `t` to tag, `Delete` to fade with the existing undo toast. Cards already have focus rings; this is mostly a roving tabindex.
4. **Quick capture (M, P1).** Three entry points that need no new UI: a PWA `shortcuts` manifest entry ("New note") that opens `/n/new`; the existing share target should land in the editor of the created note rather than the library; and `Cmd+N` from inside the editor should save and open a fresh note. Later, on iOS, this becomes the widget and Siri Shortcut target.
5. **Retire the blank-note leak (S).** When leaving an untouched new note, fade it silently. Apple Notes does exactly this.

### 4.3 Organization at scale

**Current state.** Temporal chapters bucketed on `updatedAt` (`src/utils/temporalGrouping.ts:52-90`), pinned first, then updated-desc, fixed (`src/App.tsx:1183-1191`). Flat tags with AND filtering (`src/App.tsx:1194-1201`), 20-char names, 8 colours. Masonry only; compact mode is automatic under 700 px, not chosen. No list view, no sort options, no creation-date anywhere in the UI, no bulk actions, no templates, no archive action (the "Archive" chapter is age-derived), no nested tags, no tag search in the selector.

**The tension.** "No folders. No organizing." is the landing promise and it is right for the target user. But "no organizing" must mean "the app organizes for you", and today the app has exactly one idea about how: recency. Editing a three-year-old note yanks it into "This Week", and there is no way to see notes by when they were written.

**Recommendations, all inside the no-folders philosophy.**

1. **List view (M, P1).** A second layout for the same chapters: one line per note, title, first line, tags, relative date. Toggle in the header, remembered per device. Density is the single biggest reason people leave card-only apps once they pass a few hundred notes. Keep the cards as the default and the identity.
2. **Sort and chapter basis (S, P1).** A quiet menu: chapters by last edited (today) or by created; sort within chapter by edited, created, or title. Nothing else.
3. **Search that scales (M, P1).** See 4.4.
4. **Bulk actions (M, P2).** Multi-select in list view only (checkbox on hover, `Shift`-click range): tag, pin, fade, export selected. Keep it out of the card grid.
5. **Tag quality of life (S, P2).** Search inside the tag selector; rename that preserves assignments; a "Tags" overview page with counts; `#tag` autocomplete inside the editor that assigns the tag (Bear's best-loved feature and a natural fit for plaintext tags).
6. **Note links without a graph (M, P2).** Typing `[[` opens the quick switcher and inserts a link to the chosen note (`/n/<id>`), rendered as a quiet underlined title that updates on rename. At the bottom of a note, a hover-revealed "Mentioned in" list. This is what the "Not Building" entry ("graph view / backlinks — that's Obsidian's game") should be read as excluding: the graph, not the link. Apple Notes added note links in 2023 precisely because they are not an Obsidian feature anymore. Because titles are encrypted, link resolution is client-side over the decrypted corpus, which the app already holds.
7. **Templates and a daily page (S, P2).** A "Today" action in the palette opens or creates a note titled with the date and tagged `journal`. Templates can be ordinary notes tagged `template`, offered in the palette under "New from template". No new schema.
8. **True archive (S, P3).** An explicit "Set aside" action that moves a note out of chapters into a quiet "Set aside" section, distinct from Faded (which deletes). Optional; the age-based Archive chapter covers most of it.

### 4.4 Search

**Current state.** Client-side substring match over title and `htmlToPlainText(content)` for every note on every debounced query (`src/App.tsx:1787-1794`). `htmlToPlainText` builds a `DOMParser` document and runs five `querySelectorAll` passes per note per query (`src/utils/exportImport.ts:631-672`). The card snippet is recomputed unmemoized on every `NoteCard` render (`src/components/NoteCard.tsx:36-48`). No multi-term, no ranking, no operators, no date filter, no fuzzy, no in-note find. Two unused search functions exist, one of which can never match because it filters on columns that are always empty (`src/services/offlineNotes.ts:508-549`).

**Recommendations.**

1. **Memoize plaintext per note (S, P0).** A `Map<noteId, { contentHash, plaintext }>` invalidated by `contentHash`, which the app already computes for conflict detection. This alone removes the per-keystroke DOM parsing. It stays in memory, so the "no plaintext in IndexedDB" invariant holds.
2. **Real query semantics (S, P1).** Multi-term AND, quoted phrases, `tag:journal`, `is:pinned`, `before:2026-03`, `after:`. Highlight all matches in the snippet, not only the first.
3. **Ranking and fuzziness (S, P1).** An in-memory index with MiniSearch or FlexSearch (both under 20 KB gzip, both prefix and fuzzy capable). Rebuild incrementally on note change. Title matches rank above body matches; recency breaks ties.
4. **Persisted encrypted index (M, P2).** Only needed once load-time decryption becomes the bottleneck (thousands of notes). Store the serialized index as one more AES-GCM blob in IndexedDB under the vault key. Until then, in-memory is enough and simpler.
5. **Find in note (S, P1).** As in 4.1.
6. **Delete the dead search paths (S).** `searchNotesOffline`, `searchDecryptedNotes`, and the stale "focused-gaze" comment at `src/App.tsx:602`.

### 4.5 Sync, conflicts, and correctness

**Current state.** Optimistic-local, queued, batched sync with HMAC-based conflict detection is solid. Three correctness problems undercut it:

| Finding | Evidence | Priority |
|---------|----------|----------|
| The "Two Paths" conflict modal renders two blank cards. It receives raw `ConflictInfo` whose `title`/`content` are always `''` under E2EE, so both sides show "Untitled" and an empty body. The user chooses between two indistinguishable options. | `src/App.tsx:2553`, `src/components/ConflictModal.tsx:93-96, 211-220` | P0 |
| `note_tags` are never pulled incrementally and have no realtime channel. They load only during full hydration, which is skipped whenever queued work exists. Tags assigned on one device do not appear on another until a fresh login. | `src/services/offlineNotes.ts:216-227, 258-265, 387`; `src/services/syncEngine.ts:1272-1284` | P0 |
| `Math.max(...syncedNotes.map(...))` spreads one argument per note when computing the pull cursor; this throws past roughly 65 k notes and is slow long before. | `src/services/syncEngine.ts:1274` | P1 |
| Every sync runs a full `select id` sweep of all notes and all tags for delete reconciliation. | `src/services/syncEngine.ts:1332-1348, 1418-1435` | P1 |
| Whole-note last-writer-wins with three-choice resolution (mine, theirs, both). No merge, no diff. | `src/hooks/useSyncEngine.ts:329-626` | P2 |
| The full ciphertext blob is re-sent on every 800 ms autosave; a long note is a large POST per pause. | `src/components/Editor.tsx:385-391, 441-449` | P2 |
| `reinsertNoteFromLocalRecord` resurrects notes hard-deleted on another device by design; a permanently failing `create` is exempt from staleness and pins the queue. | `src/services/syncEngine.ts:379-394, 1202` | P2 |
| `isRetryableError` classifies any error message containing "network", "fetch", "timeout", or "connection" as transient. | `src/services/syncEngine.ts:886-893` | P2 |
| Optimistic `fadedNotesCount` is incremented on both local delete and the realtime echo of the same delete; never reconciled. | `src/App.tsx:901, 1380` | P2 |
| Deleting a card that unmounts mid-animation (search typing, chapter re-render) still fires the delete from the cleanup. | `src/components/NoteCard.tsx:69-75` | P2 |

**Recommendations.**

1. **Decrypt both sides before showing the conflict modal (S, P0).** The keys are in memory. Show title, a plaintext excerpt, word count, and "edited on this device at / on another device at". Offer a visible diff of the two texts; even a paragraph-level diff makes "keep both" rarely necessary.
2. **Sync `note_tags` like everything else (S, P0).** Add them to the incremental pull keyed on `notes.updated_at` (or add a `note_tags.updated_at`), and subscribe to them in realtime alongside notes and tags. Add a regression test that assigns a tag on device A and asserts it on device B without hydration.
3. **Tombstones (M, P1).** A `deleted_notes` / `deleted_tags` table (or a `deleted_at` on tags) written by trigger, pulled by the same cursor, ends the two full-table sweeps. The launch-readiness review already proposed this.
4. **Replace the spread (S).** A loop or `reduce` over `lastSyncedAt`.
5. **Merge, eventually (L, P3).** A real fix is Yjs or Automerge for note bodies: the CRDT update stream can be encrypted per update, and it makes two devices editing one note a non-event. It is a large change to the storage model and is not urgent for a single-user app; a paragraph-level three-way merge in the conflict modal gets most of the value for a fraction of the cost.

### 4.6 Privacy, keys, and recoverability

**Current state.** Argon2id (t=3, m=64 MB, p=1) derives 64 bytes split into an AES-256-GCM key and an HMAC key (`src/lib/encryption.ts:37-42, 214-222`). The derived key **is** the note key. Consequences: there is no passphrase-change flow at all (`src/contexts/EncryptionContext.tsx:23-38`), a forgotten passphrase is terminal (`src/components/PassphraseSetup.tsx:261`), and rotating would require re-encrypting every note. Tag names and colours, timestamps, pin state, note count, and ciphertext lengths are plaintext server-side. Raw key bytes sit in `sessionStorage` and, when "Remember this browser" is on, `localStorage` (`src/contexts/EncryptionContext.tsx:48-55, 125-134`). Every export writes plaintext to disk. No passkey or biometric unlock.

**Why this is the most important section.** The product's emotional goal is "trust and safety — a personal journal that is private, secure, and yours." A journal you can lose by forgetting a phrase is not safe. Proton, 1Password, Standard Notes, and Apple's Advanced Data Protection all solved this the same way: a recovery key.

**Recommendations.**

1. **Move to a wrapped master key (M, P0).** Keep the existing note key `K` exactly as it is so no note is re-encrypted. Introduce a KEK derived from the passphrase with a fresh salt, and store `wrap(KEK, K)` in `user_metadata`. Migration is one line at next unlock: derive `K` as today, generate the wrap, store it, set a version flag. From then on:
   - **Passphrase change** re-wraps `K` under a new KEK. Seconds, offline-capable, no note churn. Invalidate remembered-browser blobs on other devices via the existing key-check version.
   - **Recovery kit**: generate a random 256-bit recovery key at setup (and, for existing users, on first unlock after migration), store `wrap(RK, K)`, and show the recovery key once as grouped base32 with a printable page and a copy button. The user must confirm they saved it before continuing. The unlock screen gets a quiet "Use recovery key" path that unwraps `K` and prompts for a new passphrase.
   - Copy: replace "There are no recovery codes" with "Your recovery key is the only other way in. Keep it somewhere you would keep a passport."
2. **Encrypt tag names (M, P1).** Tags are the one plaintext leak that says something about a person ("therapy", "divorce", "job search"). Filtering is already client-side, so a `name_ciphertext` column plus AAD `tagId:userId` costs nothing at query time. Colours can stay plaintext. Plan the migration append-only, as `docs/backlog.md` already requires.
3. **Encrypted backup (S, P1).** An `.yidhan` export: the v2 JSON, AES-GCM under a key derived from a backup passphrase (or the recovery key), with a plaintext header naming the format and version. Import accepts it. Today the only backup format writes a person's whole journal to disk in the clear.
4. **Passkey and biometric unlock (M, P2).** On the web, WebAuthn PRF (`prf` extension, supported in Chrome, Safari 18, and Android) yields a stable secret per passkey that can wrap `K`; the passphrase remains the root. On Capacitor, the Biometric plugin gates release of the remembered-browser blob from the secure keystore instead of `localStorage`. This is the single most-requested trust feature on iOS and it becomes possible only once `K` is wrappable.
5. **Publish the threat model (S, P1).** A `/security` page in the same voice as `/privacy`: what is encrypted, what is not (tags today, metadata), what the server can see, what an XSS could reach, and how to verify the build. `security.txt` in `public/`. This is how Proton and Standard Notes earn the "private" claim, and it costs a day.
6. **Reduce key exposure at rest (S, P2).** Keep `K` in a `Worker` or at least out of `sessionStorage` where the page is hidden; on mobile prefer the keystore. Acknowledged in the code comment at `src/lib/encryption.ts:52-59`.

### 4.7 Import, export, and portability

**Current state.** Export: JSON v1, one concatenated Markdown file (the function is named `downloadMarkdownZip` but produces no zip), a v2 full-account JSON, per-note JSON/Markdown, clipboard. Import: JSON v1 only, single or combined Markdown. `htmlToMarkdown` drops highlights, alignment, and `h4`–`h6`; underline round-trips as literal `&lt;u&gt;` text; Markdown import discards timestamps and tag colours (`src/utils/exportImport.ts:325-411, 420-422`; `src/App.tsx:1919-1927`). The v2 backup the offboarding flow produces cannot be re-imported (`src/utils/exportImport.ts:273`). No importer exists for any competitor.

**Recommendations.**

1. **Fix the lossy round-trip (S, P0).** Highlight to `==text==`, underline to HTML passthrough or drop with a note, `h4`–`h6` to `####`, alignment to a comment or drop. Add a round-trip property test: editor HTML → Markdown → HTML → sanitized equals the original for every construct the editor can produce.
2. **Accept v2 and encrypted backups on import (S, P0).**
3. **Export per-note Markdown in a real zip (S, P1)** with front matter (`created`, `updated`, `tags`, `pinned`). This is the interchange format Bear, Obsidian, and iA Writer users expect, and it also serves as the Obsidian importer in reverse.
4. **Importers (M, P1).** In order of reach: Apple Notes (via the standard HTML export tools and drag-in of `.txt`/`.html`), Bear (`.textbundle` and Markdown with `#tags`), Notion (Markdown zip with nested folders becoming tags), Evernote (`.enex` XML with base64 attachments, which needs 4.1's images to be worth doing), Obsidian (folder of `.md` with `[[wiki-links]]` mapped to 4.3's note links). Each importer is a pure function from file to the existing `ImportedNote` shape, so they are cheap to test.
5. **Preserve chronology on every path (S).** Timestamps and tag colours through Markdown import, pinned state through v2 import.

### 4.8 Sharing and publishing

**Current state.** Share as Letter is a well-designed E2EE capability link with a hard 30-day cap, one active share per note, static snapshot, read-only. Missing: any protection on the link itself, live updates, a "never expire" option for a person's own published writing, and Public Garden (roadmap, exploring).

**Recommendations.**

1. **Optional passphrase on a letter (S, P2).** Derive a second wrap of the share key from a short phrase told out of band; the URL alone is then not enough. Cheap, and the one feature that makes sharing a medical note or a lease feel safe.
2. **"Refresh this letter" (S, P2)** re-encrypts the current note under the existing share key and token so the link stays valid. Live Shared Letters (roadmap) falls out of doing this automatically on save; keep it opt-in per share.
3. **Public Garden (L, P3).** Worth doing only after note URLs and images exist, because a garden is a set of stable links with pictures. When it comes, keep it as static pre-rendered HTML per post so it needs no JavaScript to read.

### 4.9 Mobile and the iOS path

**Current state.** PWA with share target, install prompt, iOS install guide, bottom toolbar with keyboard-height tracking, pull-to-refresh, swipe-to-pin, TimeRibbon scrubber, and an Android Capacitor project. No `ios/` project yet.

**Findings from the mobile screenshots (verified).**

| Finding | Evidence | Priority |
|---------|----------|----------|
| On a first visit to the Practice Space on a phone, a "Quick gesture" modal covers the library one second after load, before the visitor has seen a single note. It is the first thing a mobile visitor from the landing CTA sees. | `src/components/GestureHint.tsx:4-7` | P0 |
| The TimeRibbon floats over the last card and over the footer links (Changelog, Privacy), which are half-hidden behind it. | `src/components/TimeRibbon.tsx`, footer | P1 |
| In the mobile editor the title appears twice: once as the breadcrumb strip under the header and again in the manuscript. | `src/components/Editor.tsx` header zone | P1 |
| The editor scroll container is `h-screen`, not `100dvh`, unlike the app shell, so iOS Safari's dynamic bars can clip the bottom toolbar. | `src/components/Editor.tsx:1119` vs `src/index.css:194` | P1 |
| The overflow menu closes on `mousedown` only; no touch or scroll listener; no `menuitem` roles. | `src/components/EditorToolbar.tsx:67-127` | P2 |

**Recommendations.**

1. **Replace the interstitial with a whisper (S, P0).** Show the swipe hint as a one-line caption under the first card, or as a single animated nudge on the first card after the first scroll. Never a modal on first load.
2. **Give the ribbon a home (S, P1).** Reserve bottom padding equal to the ribbon height on the library, hide the ribbon when the footer is in view, and hide it entirely under 20 notes where scrubbing has nothing to scrub.
3. **iOS Capacitor project (M, P1; needs a Mac).** The Android project already proves the shell. Add: `@capacitor/haptics` (replacing `navigator.vibrate`), `@capacitor/status-bar`, `@capacitor/keyboard`, `@capacitor/share` for a native share sheet, the secure-storage plus biometric unlock from 4.6, and the App Store privacy labels (which, for a zero-knowledge app, are the marketing asset). The mobile gap analysis in `docs/analysis/mobile-ios-gap-analysis-claude.md` has the checklist; nothing in it is blocked except the machine.
4. **After that, the two things only a native app can do (L, P2):** a home-screen widget for quick capture and "today's page", and a share extension so any app can send text into Yidhan. Both depend on note URLs (4.2).
5. **Landscape and iPad (M, P2).** The masonry already adapts; the editor needs a max line length (roughly 68 characters) and the sidebar toolbar to appear at the iPad breakpoint.

### 4.10 Performance and code health

**Measured (production build, 2026-09-06).**

| Asset | Size | Gzip |
|-------|------|------|
| `main` chunk | 788 KB | 244 KB |
| `Editor` lazy chunk | 443 KB | 134 KB |
| `vendor-supabase` | 189 KB | 50 KB |
| `vendor-sentry` | 19 KB | 7 KB |
| `vendor-react` | 3.7 KB | 1.4 KB |
| CSS | 79 KB | 15 KB |

The landing page for a first-time visitor loads `main` plus Supabase plus Sentry: roughly 1 MB of JavaScript, 300 KB gzipped, before any interaction. The `vendor-react` chunk is 3.7 KB, so React DOM is inside `main`; the manual chunking is not doing what its comment says (`vite.config.ts:20-26`). `hash-wasm` (Argon2) is statically imported into `main` (`src/lib/encryption.ts:23`) although it is only needed at unlock. Dexie, react-spring, the landing page, and the demo page all ride along.

**Structural.** `App.tsx` is 2,668 lines with 31 `useState` calls and around a dozen refs; the notes effect has six dependencies and tears down the realtime channel and refetches on any change (`src/App.tsx:781-970`). Two components set state during render (`src/components/ChapterSection.tsx:58-63, 75-80`; `src/components/TimeRibbon.tsx:70-74`). Roughly 25 react-doctor rules are suppressed repo-wide in `package.json`. Every note is decrypted at load and the whole corpus is held in memory; a single failed decryption throws and returns nothing (`src/services/encryptedNotes.ts:287-315`).

**Recommendations.**

1. **Make the landing page static (M, P1).** Prerender `/`, `/privacy`, `/terms`, `/support`, `/changelog`, `/roadmap` at build time (vite-plugin-ssr or a small Playwright prerender script) and hydrate only the theme toggle and the CTA. The landing page should be under 50 KB of JavaScript. This also fixes SEO, which the launch review flagged.
2. **Defer what the landing does not need (S, P1).** Dynamic-import Supabase on first auth or session restore; dynamic-import `hash-wasm` inside `deriveKey`; use Sentry's `lazyLoadIntegration` for replay; split the demo page from the app shell. Fix the React chunking by matching `react-dom` by module path. Expected: `main` under 300 KB.
3. **Degrade per note, not per corpus (S, P1).** A note that fails to decrypt should render as a locked card with a retry, not blank the library.
4. **Virtualize only when needed (M, P2).** Progressive rendering already handles most libraries. Measure at 2,000 notes before adding a virtual list; the list view from 4.3 is where virtualization pays off first.
5. **Decompose `App.tsx` (M, P1).** Extract in this order, each behind the existing tests: routing (4.2), `useNotesSync` (fetch, realtime, recovery), `useImport` (the 220-line pipeline at `src/App.tsx:1813-2033`), `useDemoMigration`, `useShareTarget`, and a `PublicPage` component for the five near-identical page blocks. Target: `App.tsx` under 600 lines. Then start deleting react-doctor suppressions.
6. **Delete the dead plaintext layer (S).** The unused functions in `src/services/notes.ts` and `src/services/offlineNotes.ts` that would violate the E2EE CHECK constraint if ever called; the unused `editorPosition` helpers; the unassigned `savePhaseTimeoutRef`. Less code to audit is a security feature.
7. **Run the full E2E suite in CI (S, P1).** Only the service-worker suite runs today (`.github/workflows/ci.yml:94`). Provide the test user through repository secrets.

### 4.11 Design polish toward "award-winning"

The identity is already there. What separates good from awarded is consistency under every state and a few signature moments. Findings from the screenshots and CSS:

1. **The manuscript's fixed depth.** With a short note the writing surface is a card about 490 px tall on a 900 px viewport, then the divider and "Return to notes" (verified). Let the manuscript grow with content and set a minimum of roughly 60 vh so it reads as a page, not a card. Craft's page and iA Writer's canvas both feel bottomless.
2. **A single pinned card floats alone in a wide band.** Centering one or two cards was a good fix for masonry rhythm, but a lone pinned note in a full-width chapter reads as empty (verified). Consider rendering Pinned as a compact row (title and first line) when it holds fewer than three notes.
3. **Title typography.** The title is a `textarea` with its own sizing, while H1s in the body use the editor's scale; long titles wrap to three display-size lines (verified). Cap the title at two lines with a smaller size past 60 characters, and mirror the body's H1 metrics.
4. **Transitions between views.** `useViewTransition` is now a plain `startTransition` wrapper; the View Transitions API was removed (`src/hooks/useViewTransition.ts:15-19`). A card-to-manuscript morph on open, and its reverse on return, is the one animation that would make people screenshot the app. Progressive enhancement: `document.startViewTransition` where available, instant elsewhere.
5. **Reading comfort settings.** Offer three things and nothing more: text size (three steps), line length (comfortable, wide), and body typeface (Source Sans, or a serif such as Literata, which prior docs already explored). Expose the two extra themes (Washi, Mori) that already exist in `src/themes/` but are not offered in Settings.
6. **Onboarding without a tour.** The competitive evaluation asked for feature discovery. Do it in the product's own voice: the first three notes carry one hover-revealed hint each (slash commands, tags, focus mode), and the empty search state suggests an operator. No tooltips, no coach marks.
7. **Empty and edge states.** Design the locked-note card (4.10), the "on this device only" state (already shipped), the offline editor, a note that failed to sync, and a shared letter that has expired. Award juries look at these first.
8. **Reduced motion and contrast are done well.** Keep verifying with every theme addition; add a Playwright axe pass to CI so it stays that way.

### 4.12 Onboarding and first run

- **The passphrase moment** is the highest-stakes screen in the product and currently opens with a warning checkbox. With 4.6 in place, rewrite it as three steps: choose a passphrase, save your recovery key, done. Show a single sentence about what encryption means in the product's voice.
- **Email confirmation** is the biggest drop-off in any signup; the custom SMTP item in `docs/backlog.md` is a P1 for reliability, and magic-link sign-in would remove the password entirely for people who prefer it.
- **The Practice Space** is the best onboarding asset. Route the mobile landing CTA straight into a new note in the Practice Space, not the library, so the first action is writing.
- **"No account needed" and the signup wall** (launch review #13) resolve naturally once the Practice Space can save the first note into a new account in one step, which `migrateDemoToAccount` already does. Make that path the primary CTA on the demo.

---

## 5. Sequenced plan

Phases are sized for one focused engineer plus review. Each phase is shippable on its own.

### Phase 0: Trust and fluency fixes (2–3 weeks)

All P0 items. Small, high-impact, mostly bug fixes.

- Editor: title `Enter`, `Escape` overload, link UI with `openOnClick: false`, live toolbar state.
- Sync: decrypt both sides of the conflict modal; incremental and realtime `note_tags`; replace the `Math.max` spread.
- Search: memoize plaintext by `contentHash`.
- Mobile: remove the gesture interstitial; reserve space for the ribbon.
- Portability: fix Markdown round-trip losses; accept v2 backups.
- Housekeeping: delete the dead plaintext functions.

### Phase 1: Table stakes (6–8 weeks)

- Wrapped master key, passphrase change, recovery kit, encrypted backup export, threat-model page.
- Note URLs, browser history, quick switcher / command palette, keyboard navigation, PWA shortcut for new note.
- Markdown paste, Typography, word count, find in note.
- List view, sort options, search operators with an in-memory index.
- Static landing page and bundle diet.
- `App.tsx` decomposition; full E2E in CI.

### Phase 2: Depth (8–12 weeks)

- Encrypted image attachments (editor, storage, export, letters).
- Importers: Apple Notes, Bear, Notion, Obsidian, then Evernote once images exist.
- Encrypted tag names.
- Note links with "Mentioned in"; `#tag` autocomplete; templates and a daily page.
- iOS Capacitor project with haptics, keyboard, share sheet, biometric unlock; App Store submission.
- Reading settings (size, line length, typeface) and the extra themes.
- Card-to-manuscript view transition; manuscript growth; pinned compact row.

### Phase 3: Distinction (ongoing)

- Simple tables (revisit decision), code block languages, tombstones, paragraph-level merge or CRDT bodies.
- Passkey (WebAuthn PRF) unlock on the web.
- Widget and share extension on iOS; iPad layout.
- Public Garden and refreshable letters.
- Quiet Intelligence, on-device only, per `docs/analysis/quiet-intelligence-features-claude.md`.

---

## 6. Decisions to keep, and three to revisit

**Keep.** No real-time collaboration. No folders. No push notifications. No gamification. No floating selection toolbar. No analytics tracking. Midnight as default. Paper over glass. Restraint over features. These are the reasons the product exists, and every recommendation above was checked against them.

**Revisit.**

1. **Tables.** Exclude databases, include simple tables. Apple Notes proves a table can be quiet.
2. **Backlinks.** Exclude the graph, include the link. A note that can point at another note is what makes a journal a body of work, and it is the prerequisite for Public Garden.
3. **"No recovery codes."** Recorded as a security stance; it is in fact a usability failure that competitors solved a decade ago. A recovery key held by the user keeps zero knowledge intact.

---

## 7. Success measures

No tracking is a product constraint, so measure what the app can know locally and what people say:

- Time from landing to first saved note in the Practice Space (local, aggregate, opt-in).
- Share of unlocks that use the recovery key path, and zero support requests for lost notes.
- Libraries over 500 notes without a search complaint.
- Landing page JavaScript under 50 KB; Lighthouse performance 95+ on mobile.
- `App.tsx` under 600 lines; react-doctor suppressions under 5.
- Zero blank-conflict reports; zero "my tags did not sync" reports.
- App Store review score and the phrase "finally an encrypted notes app that feels good" in the wild.

---

## Appendix A: Verified defects with locations

| # | Defect | Location | Section |
|---|--------|----------|---------|
| 1 | `Enter` in title does not move focus to body | `src/components/Editor.tsx:95-100` | 4.1 |
| 2 | `Escape` with slash menu open exits the note | `src/components/Editor.tsx:505-518` | 4.1 |
| 3 | Markdown paste inserted literally | no `handlePaste`; `src/utils/exportImport.ts:416-489` unused for clipboard | 4.1 |
| 4 | Clicking a link in the editor navigates the tab | `Link` unconfigured via StarterKit, `src/components/RichTextEditor.tsx:84` | 4.1 |
| 5 | Conflict modal shows two blank cards | `src/App.tsx:2553`, `src/components/ConflictModal.tsx:93-96, 211-220` | 4.5 |
| 6 | `note_tags` not pulled incrementally, no realtime | `src/services/offlineNotes.ts:258-265`, `src/services/syncEngine.ts:1272-1284` | 4.5 |
| 7 | `Math.max` spread over all notes | `src/services/syncEngine.ts:1274` | 4.5 |
| 8 | v2 backup cannot be re-imported | `src/utils/exportImport.ts:273` | 4.7 |
| 9 | Highlight, alignment, `h4+` lost on Markdown export; underline corrupts on round-trip | `src/utils/exportImport.ts:325-411, 420-422` | 4.7 |
| 10 | Full-account backup labels every share "Untitled" | `src/services/notes.ts:704, 718` | 4.7 |
| 11 | Gesture hint modal on first mobile visit | `src/components/GestureHint.tsx:4-7` | 4.9 |
| 12 | TimeRibbon overlaps last card and footer | `src/components/TimeRibbon.tsx` | 4.9 |
| 13 | Faded view not routeable; URL rewritten to `/` | `src/App.tsx:26, 413-423` | 4.2 |
| 14 | Editor falls through to `return null` if the open note disappears | `src/App.tsx:2596, 2665` | 4.2 |
| 15 | `NoteCard` cleanup deletes on unmount mid-animation | `src/components/NoteCard.tsx:69-75` | 4.5 |
| 16 | `fadedNotesCount` double-counts on realtime echo | `src/App.tsx:901, 1380` | 4.5 |
| 17 | `ChapteredLibrary` discards the boolean from `handleNoteDelete` | `src/components/ChapteredLibrary.tsx:21`, `src/App.tsx:1371` | 4.5 |
| 18 | Undo history crosses notes on `setContent` | `src/components/RichTextEditor.tsx:205` | 4.1 |
| 19 | Duplicate `Underline` extension | `src/components/RichTextEditor.tsx:95` | 4.1 |
| 20 | Slash menu opens off-screen near the viewport bottom | `src/components/SlashCommand.tsx:279-309` | 4.1 |
| 21 | `isRetryableError` substring matching | `src/services/syncEngine.ts:886-893` | 4.5 |
| 22 | Dead plaintext write paths still compiled | `src/services/notes.ts`, `src/services/offlineNotes.ts:114-122` | 4.10 |
| 23 | React DOM not split; Argon2 in main | `vite.config.ts:20-26`, `src/lib/encryption.ts:23` | 4.10 |
| 24 | State set during render | `src/components/ChapterSection.tsx:58-63, 75-80`, `src/components/TimeRibbon.tsx:70-74` | 4.10 |
| 25 | `pg_cron` purge commented out; 30-day faded purge relies on client load | `supabase/migrations/add_faded_notes_cleanup_cron.sql`, `src/services/notes.ts:378-406` | 4.5 |

## Appendix B: Key-hierarchy sketch

```
passphrase ──Argon2id(salt_kek)──▶ KEK ──▶ wrap(KEK, K) ─┐
                                                          ├─▶ user_metadata (server, opaque)
recovery key (random 256-bit) ──▶ wrap(RK, K) ───────────┘
passkey PRF secret (optional) ──▶ wrap(PRF, K) ──────────┘

K = the existing note key; notes are never re-encrypted.
Passphrase change  = new salt_kek, new wrap(KEK, K).
Recovery           = unwrap with RK, then set a new passphrase.
Key-check          = unchanged; still verifies K.
```

## Appendix C: Encrypted attachments sketch

- Client resizes to 2048 px, encodes WebP, encrypts with a random per-attachment key under AES-GCM with AAD `attachmentId:noteId:userId`.
- The attachment key is stored inside the note's encrypted payload (so it travels with the note and with letters).
- Ciphertext goes to Supabase Storage under `attachments/<userId>/<attachmentId>`; RLS by path prefix. Local copy in a Dexie `attachments` table (blob) so notes render offline.
- Editor node `image` with `data-attachment-id`; `src` is resolved to a blob URL at render and never persisted. Sanitizer allows `img[data-attachment-id]` only.
- Export: per-note Markdown zip includes an `attachments/` folder; encrypted backup includes them as base64.
- Limits: 5 MB per image, 200 MB per account on the free tier (Supabase free storage is 1 GB).
