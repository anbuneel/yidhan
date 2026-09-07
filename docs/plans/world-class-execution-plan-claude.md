# Yidhan improvement plan

Status: ACTIVE
Last verified: 2026-09-07

The engineering ledger for product work. It owns **what is committed now** —
nothing else.

Shipped items moved to `docs/progress.md`. Deferred items moved to
`docs/roadmap.md`, keeping their numbers so commits, PR titles and issue
cross-references still resolve. The review-coverage appendices are frozen in
`docs/archive/world-class-execution-plan-review-coverage.md`.

This plan and `2026-09-07-docs-instruction-layer-overhaul.md` are both ACTIVE by
deliberate exception — see `DECISIONS.md` (2026-09-07). They cover orthogonal
lanes: this one product work, the other the documentation layer.

## How to read this

- **Item.** One thing to do, with a plain number and the area it touches.
- **List.** An item is in **Now** or **Next**. Move it by editing this file in the
  same PR that changes it. Finished items leave for `docs/progress.md`; abandoned
  ones return to `docs/roadmap.md`.
- **PR.** A pull request closes one or more items and names them in its title:
  `Fix items 1 and 2: title Enter, slash-menu Escape`.

Effort is **days** (under a week), **weeks** (one to three), or **a month or
more**. Dates come from measured pace, not from this file. "Needs" names items
that must land first.

---

## Now

(nothing)

---

## Next

Seeded from this plan's own ordering and dependency rules after items 1–22
shipped: three loose ends from that merged block first, then the gates that other
work declares as `Needs`, then the validation cohort that items 1–22 unblocked.
**Reorder freely** — a real writer or a measurement outranks this order.

| # | Area | Item | Effort | Needs / start when | Done when |
|---|------|------|--------|--------------------|-----------|
| 150 | Sync | Reconcile pre-existing queued writes when accepting a conflict version; stale updates can remain queued after resolution | days | Needs #9 | Choosing the remote version cannot later replay an older local queued payload · integration test |
| 152 | Onboarding | Correct the old encryption claim in existing untouched demo starter copies without changing user-authored drafts | days | No local-data migrations in current scope | Existing unedited starter copies show the current privacy copy |
| 151 | Testing | Enable repository-wide unused-export lint with an audited legacy baseline | days | Needs #12, #20 | Real unused-export rule runs in CI without hiding new unused code |
| 23 | Keys and privacy | Key migration and rotation design, written and reviewed before #24: the wrapped material is the full 64 bytes (AES key and HMAC key); three distinct flows (passphrase change by re-wrap; remembered-device invalidation by key-check version bump; compromise rotation by new key and full re-encryption, #103); interrupted migration resumes; two devices changing concurrently resolve to one winner and the other re-prompts; old offline devices with a stale wrap detect the version and re-unlock; restored backups from before the migration open | days |  | Every later key change can name the flow it belongs to and the test that covers it · design doc in `docs/plans/` with the test list, each test attached to #24, #25, #26, or #103 |
| 36 | Speed and code | Deployment guard: the client reads a `schema_version` row at startup and refuses writes when the app is ahead of the database; `verify_migration_state.sql` becomes a mandatory release step run against the deployment target, recorded in the PR | days |  | An app built ahead of its migration shows a "database update pending" state instead of blocking the queue · unit test on the guard; release checklist in `docs/setup/` |
| 37 | Testing | Authenticated E2E fixture (test account, vault unlock) and the full Playwright suite in CI | days |  | `npm run e2e` runs in CI on every PR with no skipped authenticated tests · CI log |
| 87 | Process | Validation cohort: 8 to 12 target writers for several weeks with their own material and consent for content-free diagnostics; observe capture-to-save, finding an old note, long writing, interruptions, migration, restoration | ongoing | Needs items 1 to 22 shipped | Findings written up and used to reorder `docs/roadmap.md` · doc in `docs/plans/` |

---

## Working rules

- Work from **Next**. Anything that risks losing or leaking words jumps the queue.
- A PR closes items. Its title names them. The same PR removes them from this file,
  adds a line to `src/data/changelog.ts`, and appends to `docs/progress.md`.
- The "done when" is the test. It ships in the same PR as the item, never later.
- Anything needing a database change ships with the migration guard (#36) and
  `verify_migration_state.sql` run against the deployment target.
- `npm run check` on every PR. `npm run e2e` once #37 lands.
- When a real writer or a measurement says the order is wrong, change the order.
  Nothing else reorders it.
- Permanent non-goals live in `PRODUCT.md`, not here.

---

## Lookup: old IDs to numbers

| Old ID | # | Source |
|--------|---|--------|
| ATT-01 | 32 | C App C; X attachments |
| ATT-02 | 33 | X attachments |
| ATT-03 | 131 | X |
| ATT-04 | 132 | X |
| ATT-05 | 88 | C App C |
| DES-01 | 64 | C 4.11 |
| DES-02 | 65 | C 4.11 |
| DES-03 | 108 | C 4.11 |
| DES-04 | 109 | C 4.11 |
| DES-05 | 110 | C 4.11; X help heuristic |
| DES-06 | 66 | C 4.11; X status visibility |
| DES-07 | 67 | C 4.11 |
| DES-08 | 68 | X personas |
| DES-09 | 124 | X personas |
| ED-01 | 1 | C 4.1, defect 1 |
| ED-02 | 2 | C 4.1, defect 2 |
| ED-03 | 3 | C 4.1, defect 4 |
| ED-04 | 52 | C 4.1 |
| ED-05 | 53 | C 4.1 |
| ED-06 | 54 | C 4.1; X counts |
| ED-07 | 55 | C 4.1, 4.4; X find/replace |
| ED-08 | 56 | C 4.1 |
| ED-09 | 57 | X design P2; C 4.1 |
| ED-10 | 112 | C 4.1 |
| ED-11 | 113 | C 4.1 |
| ED-12 | 114 | C defect 18 |
| ED-13 | 115 | C 4.2 |
| ED-14 | 116 | C defect 20 |
| ED-15 | 130 | C 4.1 |
| ED-16 | 4 | C defect 19 |
| ED-17 | 34 | C 4.1; CX |
| ED-18 | 127 | CX; decision revisit |
| ED-19 | 97 | X next release |
| ED-20 | 128 | X |
| ED-21 | 129 | X |
| ED-22 | 31 | X next release; P architecture |
| ED-23 | 117 | C 4.9 |
| KEY-01 | 24 | C 4.6, App B; X privacy 4; #170 |
| KEY-02 | 25 | CX |
| KEY-03 | 26 | CX |
| KEY-04 | 23 | X privacy 4; P #3 |
| KEY-05 | 101 | C 4.6; X privacy 3 |
| KEY-06 | 38 | C 4.6, 4.7; X first release |
| KEY-07 | 135 | C 4.6 |
| KEY-08 | 106 | C 4.6; X "protected device key storage" |
| KEY-09 | 39 | C 4.6; X "define the promise" |
| KEY-10 | 102 | C 4.6; X privacy 5; P architecture |
| KEY-11 | 104 | X privacy 6 |
| KEY-12 | 40 | X privacy 5 |
| KEY-13a | 16 | X privacy 2; P #1 |
| KEY-13b | 47 | X privacy 2; P #1 |
| KEY-14 | 136 | X via #170 |
| KEY-15 | 41 | C 4.10; X first release |
| KEY-16 | 103 | X privacy 4; P #3 |
| LIB-01 | 30 | C 4.3 |
| LIB-02 | 48 | C 4.3 |
| LIB-03 | 98 | C 4.3 |
| LIB-04 | 93 | C 4.3 |
| LIB-05 | 92 | C 4.3; X connections |
| LIB-06 | 94 | C 4.3 |
| LIB-07 | 139 | C 4.3 |
| LIB-08 | 95 | X retrieval |
| LIB-09 | 140 | X connections |
| LIB-10 | 49 | X design P2 |
| LIB-11 | 111 | C 4.11 |
| LIB-12 | 99 | C 4.10; X scale |
| MOB-01 | 13 | C 4.9 |
| MOB-02 | 14 | C 4.9 |
| MOB-03 | 83 | C 4.9 |
| MOB-04a | 84 | P #7 |
| MOB-04b | 105 | C 4.9; X release 4; P #7 |
| MOB-05 | 137 | C 4.9; X release 4 |
| MOB-06 | 138 | C 4.9 |
| MOB-07 | 107 | X minor observations |
| MOB-08 | 85 | X; C mobile docs |
| NAV-01 | 28 | C 4.2; X connections |
| NAV-02 | 29 | C defects 13 and 14 |
| NAV-03 | 42 | C 4.2; X retrieval |
| NAV-04 | 43 | C 4.2; X keyboard selection |
| NAV-05 | 44 | C 4.2; X capture |
| NAV-06 | 96 | X capture |
| NAV-07 | 45 | C 4.12; X design P2 |
| NAV-08 | 145 | X capture |
| ONB-01 | 15 | X privacy 1, X design P1 |
| ONB-02 | 27 | C 4.12 |
| ONB-03 | 86 | C 4.12; backlog P1 |
| ONB-05 | 46 | C 4.12; launch review #13 |
| OPS-01 | 87 | X sequence |
| OPS-02 | 126 | X sustainable; monetization docs |
| OPS-03 | 148 | this doc |
| OPS-04 | 146 | X sequence; C |
| OPS-05 | 21 | C §6 |
| OPS-06 | 22 | cross-check |
| OPS-07 | 147 | this doc |
| PERF-01 | 60 | C 4.10 |
| PERF-02 | 61 | C 4.10; X sustainable |
| PERF-03 | 62 | X sustainable; C 4.1 audit |
| PERF-04 | 63 | C 4.10; X sustainable |
| PERF-05 | 20 | C 4.10, defect 22 |
| PERF-06 | 120 | C defect 24 |
| PERF-07a | 36 | X sustainable; P #4 |
| PERF-07b | 121 | X sustainable |
| PORT-01 | 17 | C 4.7, defect 9 |
| PORT-02 | 18 | C 4.7, defects 8 and 10 |
| PORT-03 | 76 | C 4.7; X migration |
| PORT-04 | 77 | C 4.7 |
| PORT-05 | 78 | X migration |
| PORT-06a | 89 | C 4.7; X migration |
| PORT-06b | 133 | C 4.7; X |
| PORT-07 | 90 | X migration |
| PORT-08a | 91 | X next release |
| PORT-08b | 134 | X |
| QA-01 | 37 | C 4.10; X quality gates |
| QA-02a | 79 | X quality gates |
| QA-02b | 125 | X quality gates |
| QA-03 | 80 | X quality gates; C §7 |
| QA-04 | 81 | X quality gates |
| QA-06 | 82 | X next release |
| SAVE-01 | 5 | X first release |
| SAVE-02 | 6 | X first release |
| SAVE-03 | 7 | X first release, X design P1 |
| SAVE-04 | 58 | X first release |
| SAVE-05a | 59 | X first release |
| SAVE-05b | 118 | X first release |
| SAVE-06 | 119 | C 4.1 audit |
| SHR-01 | 122 | C 4.8 |
| SHR-02 | 123 | C 4.8; roadmap |
| SHR-03 | 141 | C 4.8; roadmap |
| SHR-04 | 19 | X quality gates; P #6 |
| SRCH-01 | 11 | C 4.4; X scale |
| SRCH-02 | 50 | C 4.4; X retrieval |
| SRCH-03 | 51 | C 4.4; X scale |
| SRCH-04 | 142 | C 4.4 |
| SRCH-05 | 12 | C 4.4 |
| SRCH-06 | 100 | X scale |
| SYNC-01 | 9 | C 4.5, defect 5; X "preserve both revisions" |
| SYNC-02 | 8 | C 4.5, defect 6 |
| SYNC-03 | 10 | C defect 7 |
| SYNC-04 | 70 | C 4.5; launch review |
| SYNC-05 | 35 | X first release; P #2 |
| SYNC-06 | 71 | X first release |
| SYNC-07 | 72 | C defect 21 |
| SYNC-08 | 73 | C defect 16 |
| SYNC-09 | 74 | C defects 15 and 17; P #6 |
| SYNC-10 | 69 | C 4.5; X first release; P #2 |
| SYNC-11 | 143 | C 4.5 |
| SYNC-12 | 144 | C 4.5 |
| SYNC-13 | 75 | C defect 25 |

---
