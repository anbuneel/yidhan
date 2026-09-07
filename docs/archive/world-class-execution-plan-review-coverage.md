# World-class execution plan — review coverage (frozen)

Frozen appendices from the execution ledger, recording which findings of the
2026-09 Claude and Codex reviews each numbered item covers, and what changed in
plan version 1.2. Kept for provenance only; not authoritative for current work.

---

## Appendix A: Coverage of the Claude review

| Claude review section | Ledger IDs |
|-----------------------|-----------|
| §1 ten moves | 1 #24/02/03 · 2 #34, #32/02 · 3 #1/02/03/04 · 4 #28/03 · 5 #30/02, #50/03 · 6 #9/02/03 · 7 #17/02/03/06, #38 · 8 #60/02 · 9 #13/02/03/04, #106 · 10 #63 |
| §4.1 findings table (15 rows) | #1, #2, #3, #52, #34, #56, #54 and #55, #53, #112, #113, #57 (TextAlign and inline code), #114, #115, #116 and #130, #4 |
| §4.1 recommendations 1 to 8 | #1/02, #3, #52, #53/06, #55, #34, #56, #127 |
| §4.2 recommendations 1 to 5 | #28/02, #42, #43, #44, #115 |
| §4.3 recommendations 1 to 8 | #30, #48, #11/02/03, #98, #93, #92, #94, #139 |
| §4.4 recommendations 1 to 6 | #11, #50, #51, #142, #55, #12 |
| §4.5 findings table (10 rows) | #9, #8, #10, #70, #144 (merge), #143 (blob per save), #69, #72, #73, #74 |
| §4.5 recommendations 1 to 5 | #9, #8, #70, #10, #144 |
| §4.6 recommendations 1 to 6 | #24/02/03 and #27, #101, #38, #135 and #106, #39, #102 |
| §4.7 recommendations 1 to 5 | #17, #18 and #38, #76, #89/b, #77 |
| §4.8 recommendations 1 to 3 | #122, #123, #141 |
| §4.9 findings table (5 rows) | #13, #14, #83 (title), #83 (dvh), #117 |
| §4.9 recommendations 1 to 5 | #13, #14, #84/b and #106, #137, #138 |
| §4.10 measurements and structure | #60/02 (bundle), #63 (App.tsx), #120 (set-state-in-render), #41 (eager decrypt throws) |
| §4.10 recommendations 1 to 7 | #60, #61, #41, #99, #63, #20 and #119, #37 |
| §4.11 items 1 to 8 | #64, #111, #65, #108, #109, #110, #66, #67 |
| §4.12 items (4) | #27, #86, #45, #46 |
| §5 phases | replaced by the Next and Later lists |
| §6 decisions to revisit | #21, #127, #92, #26 |
| §7 success measures | #80, #87 |
| Appendix A defects 1 to 25 | 1 #1 · 2 #2 · 3 #52 · 4 #3 · 5 #9 · 6 #8 · 7 #10 · 8 #18 · 9 #17 · 10 #18 · 11 #13 · 12 #14 · 13 #29 · 14 #29 · 15 #74 · 16 #73 · 17 #74 · 18 #114 · 19 #4 · 20 #116 · 21 #72 · 22 #20 · 23 #61 · 24 #120 · 25 #75 |
| Appendix B key hierarchy | #24, #25, #26, #135, #103 |
| Appendix C attachments | #32, #33, #34, #88 |
| Operating model (this document) | #148, #147 |

## Appendix B: Coverage of the Codex review

| Codex section | Ledger IDs |
|---------------|-----------|
| Recommendation (complete journey; retain the architecture) | framing; no rewrite is a rule of this plan |
| What deserves preservation | "What stays out" and the design identity are protected in every phase |
| Competitive benchmarks (Apple ADP, Bear Web, Notion offline, Craft, Notesnook) | Scorecard corrected in the cross-check; no work items |
| First release: save state must describe durable state | #5, #6, #7, #58 |
| First release: encrypted revision history and independent recovery | #59, #118, #38 |
| First release: concurrent updates safe at the server | #35, #71, #69 |
| First release: isolate damaged records | #41 |
| Privacy 1: correct the practice-space promise | #15 |
| Privacy 2: protect incoming capture | #16, #47 |
| Privacy 3: encrypt semantic metadata | #101 |
| Privacy 4: usable recovery and key rotation; issue #170 (D1 salt, D19 rotation) | #24, #25, #26, #23, #136, #103, #22 |
| Privacy 5: browser key persistence and outbound data | #102, #40 |
| Privacy 6: independent security review | #104 |
| Next release: outline, find/replace, counts, folding, tables, footnotes | #97, #55, #54, #128, #127, #129 |
| Next release: preserve selection, undo, IME, paste, keyboard | #82 |
| Next release: PDF/print, Markdown, DOCX | #91, #17/05, #134 |
| Next release: one document-command model | #57 |
| Next release: versioned structured document format, no editor replacement | #31 |
| Capture: one action to a draft, private new-note URL, shortcuts, append capture, clipper | #45, #28, #44, #96, #145 |
| Retrieval: switcher, ranked search, filters, snippets, keyboard, saved searches | #42, #51, #50, #11, #43, #95 |
| Connections: note URLs, links/backlinks, lightweight collections | #28, #92, #140 |
| Scale: cache text, worker index, encrypted-at-rest index, virtualize results | #11, #51, #142, #99 and #100 |
| Attachments: images and PDFs, OCR, encrypted lifecycle | #34, #32, #33, #131, #132 |
| Migration: previewed imports, counts, real parser, per-note export | #89/b, #90, #78, #76 |
| Design critique P1 privacy and storage language | #15, #7 |
| Design critique P1 actionable failure status | #5 |
| Design critique P2 responsive command consistency | #57 |
| Design critique P2 preserve readable words | #49 |
| Design critique P2 capture and browser navigation | #45, #28 |
| Personas, cognitive load, accessibility | #68, #124, #107, #110 |
| Quality gates: browsers and devices | #81, #85 |
| Quality gates: fixture and journey list | #37, #79, #125 |
| Quality gates: stale E2E expectations | #19 |
| Quality gates: recommended targets | #80 |
| Sustainable: extract responsibilities | #63 |
| Sustainable: input path and dynamic imports; preserve offline assets | #62, #61 |
| Sustainable: migration ordering and drift | #36, #121 |
| Sustainable: willingness to pay and cost model | #126 |
| Sequence table and defer list | the Later list; #146 |
| Validation cohort of 8 to 12 writers | #87 |
| Heuristic score 25/40 | informational; its P1 and P2 items are mapped above |

## Appendix C: Codex plan review (2026-09-07) and what changed in 1.2

> Historical. "Phase" and "WP" below refer to the structure of version 1.2, replaced by the numbered lists in version 2.0. Item numbers have been substituted for the old IDs.

| # | Codex point | Verified against code | Change in this revision |
|---|-------------|-----------------------|-------------------------|
| 1 | The interim capture fix was a no-op: the URL is already scrubbed at init (`src/hooks/useShareTarget.ts:98`); the exposure is the initial GET request itself | Yes | #16 now removes the GET `share_target` in Phase 0; #47 (service-worker-intercepted POST with locked-vault handling and a no-plaintext-on-the-wire test) moves from Phase 2 to Phase 1 and no longer waits for the iOS share extension |
| 2 | A bare conditional update cannot distinguish a stale write from a missing row, and the zero-row path re-creates the note (`src/services/syncEngine.ts:634`); reinsertion resurrects remote deletes (`:380`); #75 purged before #69 settled the policy | Yes | #35 is now an RPC contract with four outcomes, mutation ids, and replay semantics, with S0-3 to S0-5 tests; #69 moved to Phase 1 and made a prerequisite of #75; a "Deletion policy" chain added to the spine |
| 3 | #25 "completes offline in seconds" was unsafe shorthand; both keys must be wrapped (`src/lib/encryption.ts:37`); passphrase change, device invalidation, and compromise rotation are different things | Yes | #23 is now a written prerequisite of #24 with the test list; #25 requires server confirmation before invalidating the old wrap and defines concurrent-change behaviour; #103 added for compromise rotation by re-encryption; interrupted-migration and old-device tests attached in Phase 1 |
| 4 | "No known way to lose words" overstated Phase 0; fault-injection and migration checks arrived later | Yes | Phase 0 exit rewritten as zero lost acknowledged edits across the named S0 set with tests shipped in the same PRs; #36 (schema guard plus release check against the deployment target) added to Phase 0 before the first database change; sequencing rules 6 and 7 added |
| 5 | Calendar estimates contradicted item sizes at one engineer | Yes | Calendar labels withdrawn; "Sizing and forecasting" section added with engineer-week totals per phase; Phase 1 split into Committed core and Proposed stretch; forecasting from measured throughput after Phase 0 |
| 6 | ID coverage is not acceptance coverage; Phase 3 had no "done when"; "Green", "Design reviewed", "Dashboard in CI" named activities not behaviour; #74 as written could cancel an intended delete (`src/components/NoteCard.tsx:50`); #19 also had to fix the anonymous-view test dropping the `#k=` fragment (`e2e/sharing.spec.ts:131`) | Yes | Every row now has behaviour plus evidence; Phase 3 has a gate column and a "done when" column; #74 rewritten as exactly-once with failure recovery and deliberate Undo; #19 rewritten to replace obsolete expectations including the fragment |
| 7 | Browser readiness should gate iOS; the Android wrapper does not establish iOS readiness; exploratory items need explicit gates; urgent trust fixes should cross phases | Accepted | #84/#105 split into a one-week spike (#84, Phase 1) and the shell (#105, gated on Phase 1 exit, a #81 device pass, and a spike "go"); a "Browser before native" chain added; every Phase 3 row carries a demand or measurement gate; the operating model allows trust fixes across phases |
| A | A Worker gives execution isolation, not protected persistent storage | Accepted | #102 rewritten to say exactly that and to point persistent protection at #135 and #106 |
| B | "JSON behind the same sanitizer" is insufficient; the sanitizer takes HTML strings (`src/utils/sanitize.ts:57`) | Yes | #31 rewritten: JSON is canonical with a `docVersion`, validated against the editor schema, HTML derived for display and export, older clients open newer documents read-only |
| C | Generate issues incrementally for ready work | Declined by the repository owner | The ledger and Board remain the tracker (#148) |
| 149 | Testing | Stabilize the existing PassphraseUnlock component tests under CPU contention; an untouched full-suite run timed out during typing and leaked partial input into the next case | days | No key-behavior changes | Repeated suite runs isolate cleanup and pass under load |
