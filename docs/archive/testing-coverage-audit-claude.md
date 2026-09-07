# Testing Coverage Audit â€” Yidhan

**Version:** 1.4
**Last Updated:** 2026-03-01
**Status:** Living Document
**Author:** Claude (Opus 4.6)
**Reviewed By:** Codex (GPT-5)
**Merged By:** Claude (Opus 4.6)
**Post-Implementation Assessment:** Codex (GPT-5.3)

---

## Implementation Progress (v1.3)

### Overall: Phases 0-3 are ~85% complete

| Phase | Status | PR | Tests Added | Review |
|-------|--------|-----|-------------|--------|
| **Phase 0: CI Hardening** | **Done** (1 item remaining) | [#142](https://github.com/anbuneel/yidhan/pull/142) | Coverage thresholds, E2E fixes | `65e758d4` (3 rounds) |
| **Phase 1: Offline Pipeline** | **Done** | [#144](https://github.com/anbuneel/yidhan/pull/144) | ~100 tests | `17fdab19` (2 rounds) |
| **Phase 2a: Validation + Migration** | **Done** | [#147](https://github.com/anbuneel/yidhan/pull/147) | 26 tests | `d2e8b4f6` (2 rounds) |
| **Phase 2b: Security Hooks** | **Partial** (hooks done, contexts not) | [#147](https://github.com/anbuneel/yidhan/pull/147) | 57 tests | `d2e8b4f6` (2 rounds) |
| **Phase 3: UX Components** | **Partial** (components done, E2E import not) | [#147](https://github.com/anbuneel/yidhan/pull/147) | 39 tests | `d2e8b4f6` (2 rounds) |
| **Phase 4: Post-Launch** | Not started | — | — | — |

### Current Numbers

| Metric | Pre-Plan | Current | Change |
|--------|----------|---------|--------|
| Test files | 23 | 35 | +12 |
| Unit test cases | ~670 | 809 | +139 |
| Line coverage | ~25% | 41% | +16% |
| Branch coverage | ~22% | 37% | +15% |
| Function coverage | ~21% | 34% | +13% |
| Statement coverage | ~24% | 40% | +16% |
| Coverage thresholds in CI | None | 40/35/32/38% | Enforced |
| E2E in CI | No | No | Unchanged |

### Remaining Items (Pre-Launch)

| # | Item | Phase | Planned Cases | Notes | Codex Finding |
|---|------|-------|---------------|-------|---------------|
| 1 | `EncryptionContext.tsx` — key lifecycle tests | 2b | 8-10 | Key derivation, lock/unlock, stale key detection | #4 |
| 2 | `AuthContext.tsx` — sensitive action gating | 2b | 5-8 | Step-up auth, OAuth state differences | #4 |
| 3 | E2E import roundtrip (`setInputFiles`) | 3 | 2-3 | Real file upload flow | #3 |
| 4 | Playwright smoke job in CI | 0 | — | E2E still only runs locally | #1 |
| 5 | Auth E2E credential-guard hardening | 0 | — | Prevent silent skip when env creds missing | #2 |
| 6 | Orchestration-layer smoke tests | 4 | 5-10 | `App.tsx`, `SettingsModal`, `SessionTimeoutModal`, `ReAuthModal` wiring | #4 (new) |

### Deferred Review Findings

Tracked in GitHub issues for future work:
- [#138](https://github.com/anbuneel/yidhan/issues/138) — Persistence-UX mismatch (from Remember Browser review)
- [#139](https://github.com/anbuneel/yidhan/issues/139) — Shared storage keys
- [#140](https://github.com/anbuneel/yidhan/issues/140) — Vault persistence tests
- [#141](https://github.com/anbuneel/yidhan/issues/141) — Type design improvements
- [#148](https://github.com/anbuneel/yidhan/issues/148) — Phase 2-3 deferred test improvements (10 items)

---

## Original Prompt

> You are a testing architect/expert that specializes in building effective testing coverage for full stack apps to deliver high quality products. Review the testing coverage for this app across all levels â€” unit, e2e, integration etc., identify gaps and propose a plan to increase the coverage that will directly improve product quality and has good regression as a safety net for the future. Find a good balance between over-engineering and right amount of testing.

---

## Current State at a Glance

> **Updated 2026-03-01** after Phases 0-3 (partial). Original baseline shown for comparison.

| Layer | Baseline | Current | Health |
|-------|----------|---------|--------|
| **Unit tests** | 23 files, ~594 cases | 35 files, 809 cases | Strong |
| **E2E tests** | 6 suites, ~76 cases | 6 suites, ~76 cases | Unchanged |
| **Components** | 9 tested (16%) | 12 tested (~22%) | PassphraseSetup/Unlock, ConflictModal added |
| **Services** | 8 tested (67%) | 12 tested (~92%) | Offline pipeline + demoMigration covered |
| **Hooks** | 3 tested (21%) | 7 tested (~50%) | Session/vault/idle hooks covered |
| **Utils** | 6+ tested (~40%) | 7+ tested (~47%) | Validation covered |
| **Coverage in CI** | None | 40/35/32/38% floors | Enforced via `test:coverage` |

### Testing Philosophy

The existing testing is **deep but narrow**. The 96 export/import tests and 65 notes CRUD tests show excellent rigor where tests exist â€” but the *offline-first data pipeline* (the actual path every user's data flows through) has zero test coverage. This is the biggest launch risk.

> **Post-implementation note:** The offline pipeline gap has been closed (Phase 1). The remaining gaps are `EncryptionContext` and `AuthContext` context-level tests, and E2E import roundtrip.

---

## What's Strong

1. **Crypto primitives** (21 tests) â€” AES-256-GCM roundtrips, tamper detection, wrong-key rejection. Solid.
2. **Export/Import** (96 tests) â€” Extremely thorough validation, format conversion, edge cases.
3. **Auth component** (44 tests) â€” Login, signup, OAuth, password reset all covered.
4. **Editor** (40 tests) â€” Rich text editing, autosave, keyboard shortcuts.
5. **Test infrastructure** â€” Clean factories, Supabase mocks, proper isolation. This foundation means adding new tests will be *fast*.
6. **CI pipeline** â€” `npm run check` runs typecheck + lint + test + build. Good gate.

---

## Critical Gaps (Ranked by Launch Impact)

### Gap 1: The Offline-First Data Pipeline is Completely Untested

This is the **#1 risk**. Every user action flows through this pipeline:

```
User action â†’ encryptedNotes.ts â†’ offlineNotes.ts â†’ IndexedDB (Dexie) â†’ syncEngine.ts â†’ Supabase
```

**What's untested:**
- `encryptedNotes.ts` â€” The encryption wrapper that sits between the app and storage. A bug here = **data corruption or loss**.
- `offlineNotes.ts` â€” Offline-aware CRUD with sync queue. A bug here = **notes silently not syncing**.
- `offlineTags.ts` â€” Same for tags.
- `syncEngine.ts` has 22 tests for state management, but the actual **push/pull sync logic** and **conflict resolution integration** are lightly covered.

**Why this matters for launch:** If a user creates a note offline and it fails to sync when they come back online, they lose data. There's no test that validates this end-to-end flow.

### Gap 2: Validation Utils Are Untested

`src/utils/validation.ts` guards note titles and content â€” it's the **input boundary** for user data. Zero tests.

### Gap 3: Demo-to-Account Migration

`demoMigration.ts` runs **once** during signup for users who tried the demo. It handles tag deduplication and encrypted note creation. If it fails, the user's demo work disappears. Zero tests.

### Gap 4: Passphrase Setup/Unlock Flows

`PassphraseSetup.tsx` and `PassphraseUnlock.tsx` are the E2EE gatekeepers. A UX bug here (wrong error message, state stuck) blocks the user from accessing *all* their notes. Zero component tests.

### Gap 5: No Coverage Thresholds

There's no minimum coverage enforced in CI. Tests can silently regress â€” someone could delete a test file and CI would still pass.

### Gap 6: Key Hooks Untested

| Hook | Risk if broken |
|------|---------------|
| `useSyncEngine` | Notes stop syncing |
| `useSessionTimeout` | Sessions never expire or expire too aggressively |
| `useVaultSettings` | Auto-lock timer broken, keys persist when they shouldn't |
| `useIdleTimer` | Vault auto-lock stops working |

### Gap 7: E2E Tests Don't Run in CI

E2E tests only run locally. Regressions in authentication, note creation, and sharing can slip into production undetected.

---

## Proposed Plan: 3 Tiers

**Philosophy:** Test the data pipeline first, user-facing flows second, polish third. Maximum launch confidence with minimum over-engineering.

### Tier 1 â€” Must-Have for Launch (~120â€“150 new test cases)

These tests catch **data loss, corruption, and security issues**.

| What to test | Type | Why | Est. cases |
|---|---|---|---|
| `encryptedNotes.ts` â€” encrypt/decrypt wrapper | Unit | Every note passes through this. A bug = data corruption. | 20â€“25 |
| `offlineNotes.ts` â€” offline CRUD + sync queue | Unit | Notes go through here before sync. | 25â€“30 |
| `offlineTags.ts` â€” offline tag ops | Unit | Ensures tags survive offline/online transitions. | 10â€“15 |
| `validation.ts` â€” input validation | Unit | Guards all user input. Cheap to test, high value. | 15â€“20 |
| `demoMigration.ts` â€” demoâ†’account migration | Unit | Runs once per signup. Must not lose demo data. | 10â€“15 |
| `syncEngine.ts` â€” expand push/pull/conflict tests | Unit | Existing 22 tests are state-focused; add data-flow tests. | 15â€“20 |
| Coverage threshold in CI | Config | Set floor (~60â€“70%) to prevent silent regression. | â€” |

**Why unit tests for the offline pipeline, not E2E?** The offline pipeline uses IndexedDB (Dexie), which can be mocked with `fake-indexeddb`. This lets you test the full offlineâ†’queueâ†’sync flow in milliseconds, without a real browser or Supabase. E2E can't easily test offline scenarios anyway (disconnecting network mid-test is fragile).

### Tier 2 â€” Should-Have Before Launch (~80â€“100 new test cases)

These catch **UX breakage in core flows**.

| What to test | Type | Why | Est. cases |
|---|---|---|---|
| `PassphraseSetup.tsx` | Component | First-time E2EE setup â€” wrong state = user locked out. | 10â€“15 |
| `PassphraseUnlock.tsx` | Component | Returning user unlock â€” error handling critical. | 10â€“15 |
| `useSessionTimeout` + `useIdleTimer` | Hook | Timer logic is tricky. Wrong timeout = bad UX or security gap. | 10â€“12 |
| `useVaultSettings` + `useSessionSettings` | Hook | Controls key persistence and auto-lock. | 8â€“10 |
| `NoteCard.tsx` | Component | Rendered hundreds of times â€” visual bugs affect everyone. | 8â€“10 |
| `SettingsModal.tsx` â€” security tab | Component | Already has 13 E2E tests; unit tests for edge cases. | 10â€“12 |
| `ConflictModal.tsx` | Component | Conflict resolution is rare but high-stakes (user picks wrong = data loss). | 8â€“10 |
| `demoStorage.ts` | Unit | Practice Space storage. If broken, demo users bounce. | 10â€“12 |

### Tier 3 â€” Nice-to-Have Post-Launch (~50â€“70 new test cases)

Polish and long-term regression safety.

| What to test | Type | Why | Est. cases |
|---|---|---|---|
| Accessibility (axe-core integration) | Unit/E2E | WCAG compliance. Add `@axe-core/react` or Playwright axe. | 10â€“15 |
| Mobile E2E viewport tests | E2E | Uncomment Playwright mobile configs. Test touch flows. | 10â€“15 |
| `SwipeableNoteCard` + `PullToRefresh` | Component | Mobile gesture components. | 8â€“10 |
| `BottomSheet.tsx` | Component | Animation + touch interaction edge cases. | 5â€“8 |
| Visual regression (optional) | E2E | Playwright screenshot comparison for theme consistency. | 10â€“15 |
| `lazyWithRetry.ts` | Unit | Code-split chunk loading retry logic. | 5â€“8 |

---

## CI & Infrastructure Recommendations

| Recommendation | Impact | Effort |
|---|---|---|
| **Add coverage thresholds** (`vitest` config, 65â€“70% floor) | Prevents silent regression | Low |
| **Add coverage to CI** (`npm run test:coverage` in GitHub Actions) | Visibility into trends | Low |
| **E2E in CI with mock Supabase** (MSW or similar) | Catch integration bugs in CI | Medium-High |
| **Pre-commit test run for changed files** | Faster feedback loop | Low |

**On E2E in CI without credentials:** Introducing [MSW (Mock Service Worker)](https://mswjs.io/) to intercept Supabase API calls and return fixture data would let E2E tests run in CI without real credentials â€” testing the UI integration layer while mocking the network. Medium effort investment but unlocks CI E2E permanently.

---

## Merged Execution Plan (v1.2)

This plan merges Claude's tier-based approach with Codex's risk-ranked phases into a single execution order. Both reviewers independently rated the offline encrypted sync pipeline as the #1 risk.

### Phase 0: CI Hardening (1–2 days) — PR [#142](https://github.com/anbuneel/yidhan/pull/142) ✅

Harden the gate *before* adding tests behind it.

- [x] Add Vitest coverage thresholds in `vite.config.ts`:
  - Global floor: 40/35/32/38% (ratcheted progressively, not per-directory — see note below)
- [x] Add `npm run test:coverage` step to GitHub Actions CI workflow
- [x] Fix weak/no-op E2E assertions (conditional assertions that pass vacuously, unpin test missing final assertion)
- [ ] Add a small Playwright smoke job in CI for `auth → create note → export` (or make auth E2E skip explicit/failing)

> **Implementation note:** Per-directory thresholds (services 75%, contexts 70%, hooks 60%) were not adopted. Instead, a global floor is ratcheted upward with each phase. This is simpler to maintain and avoids false failures when coverage shifts between directories due to refactoring.

**Source:** Codex P0 findings + Claude CI recommendations

### Phase 1: Offline/Encrypted Data Pipeline (3–5 days) — PR [#144](https://github.com/anbuneel/yidhan/pull/144) ✅

Both reviewers rated this P0. Every user action flows through this untested path.

- [x] Install `fake-indexeddb` for Dexie mocking in unit tests
- [x] `encryptedNotes.ts` — encrypt/decrypt wrapper (20–25 cases)
  - Roundtrip: create encrypted → read decrypted
  - Wrong key rejection, tampered payload detection
  - AAD mismatch (noteId/userId swap)
  - Null/empty content edge cases
- [x] `offlineNotes.ts` — offline CRUD + sync queue (25–30 cases)
  - Create/update/delete while offline → verify queued in IndexedDB
  - Queue processing on reconnect
  - Concurrent edits to same note
  - Realtime upsert handling (cross-device changes)
- [x] `offlineTags.ts` — offline tag operations (10–15 cases)
  - Tag CRUD while offline → sync on reconnect
  - Tag-note association persistence
- [x] `syncEngine.ts` — expand with behavior tests (15–20 cases)
  - `processQueue`: realistic push with Supabase mock responses
  - `pullRemoteChanges`: cursor-based incremental pull
  - Conflict branches: HMAC mismatch → conflict detection
  - Retry exhaustion → proper cleanup
  - Self-echo suppression via `pendingMutations`

**Source:** Claude Tier 1 + Codex Phase 1 (consensus)

### Phase 2a: Validation + Demo Migration (1–2 days) — PR [#147](https://github.com/anbuneel/yidhan/pull/147) ✅

Cheap tests with high launch value.

- [x] `validation.ts` — input boundary tests (17 cases)
  - Title length limits, content length limits
  - XSS payloads rejected
  - Empty/whitespace-only input handling
  - Unicode and emoji edge cases
- [x] `demoMigration.ts` — demo→account migration (9 cases)
  - Tag deduplication (demo tags vs existing account tags)
  - Encrypted note creation from plaintext demo notes
  - Partial failure handling (some notes migrate, some fail)
  - Empty demo state (no notes to migrate)

**Source:** Claude Tier 1

### Phase 2b: Security Hooks + Contexts (2–3 days) — PR [#147](https://github.com/anbuneel/yidhan/pull/147) (hooks ✅, contexts remaining)

Session and vault security behavior — prevents keys persisting longer than intended.

- [x] `useSessionTimeout` + `useIdleTimer` — timer tests with `vi.useFakeTimers` (13 + 9 = 22 cases)
  - Timeout fires after configured duration
  - Activity resets timer
  - Warning modal appears before expiry
- [x] `useVaultSettings` + `useSessionSettings` — persistence tests (11 + 24 = 35 cases)
  - Auto-lock timer settings persisted per-user
  - “Remember this browser” toggle behavior
  - Lock reason differentiation (auto-lock vs manual vs sign-out)
- [ ] `EncryptionContext.tsx` — key lifecycle tests (8–10 cases)
  - Key derivation → state + sessionStorage
  - Lock clears keys from memory
  - Unlock restores from sessionStorage
  - Stale key detection after passphrase change
- [ ] `AuthContext.tsx` — sensitive action gating (5–8 cases)
  - Step-up auth triggers for sensitive operations
  - OAuth vs email auth state differences

**Source:** Claude Tier 2 + Codex Phase 2 (consensus)

### Phase 3: UX-Critical Components + Import E2E (2–3 days) — PR [#147](https://github.com/anbuneel/yidhan/pull/147) (components ✅, E2E import remaining)

- [x] `PassphraseSetup.tsx` — first-time E2EE setup (10 cases)
  - Happy path: set passphrase → key derived → vault unlocked
  - Passphrase mismatch on confirm
  - Weak passphrase rejection
  - Error state recovery
- [x] `PassphraseUnlock.tsx` — returning user unlock (12 cases)
  - Correct passphrase → unlock
  - Wrong passphrase → error message
  - “Remember this browser” auto-unlock flow
- [x] `ConflictModal.tsx` — conflict resolution (17 cases)
  - Choose local vs remote version
  - Diff display correctness
  - Cancel without resolution
- [ ] E2E import roundtrip — real file upload (2–3 cases)
  - `setInputFiles` with JSON → parse → create notes → verify in library
  - `setInputFiles` with Markdown → same flow
  - Invalid file → error messaging

**Source:** Claude Tier 2 + Codex Phase 3

### Phase 4: Post-Launch Polish (Ongoing)

- [ ] Accessibility testing (`@axe-core/react` or Playwright axe)
- [ ] Mobile E2E viewport tests (uncomment Playwright mobile configs)
- [ ] `SwipeableNoteCard` + `PullToRefresh` gesture tests
- [ ] `BottomSheet.tsx` animation edge cases
- [ ] Visual regression via Playwright screenshot comparison
- [ ] `lazyWithRetry.ts` chunk loading retry logic
- [ ] `NoteCard.tsx` rendering tests
- [ ] `demoStorage.ts` localStorage operations

**Source:** Claude Tier 3

---

## Projected Outcomes

| Metric | Baseline | Projected (0-1) | **Actual (0-1)** | Projected (0-3) | **Actual (0-3)** | Phase 4 |
|--------|----------|-----------------|------------------|-----------------|------------------|---------|
| Total test cases | ~670 | ~800 | **~790** | ~950 | **809** | ~1020 |
| Offline pipeline coverage | 0% | ~80% | **~80%** | ~80% | **~80%** | ~80% |
| E2EE service coverage | 0% | ~70% | **~70%** | ~85% | **~70%** | ~85% |
| Critical hook coverage | 21% | 21% | **21%** | ~55% | **~50%** | ~55% |
| Context coverage | 0% | 0% | **0%** | ~60% | **0%** | ~60% |
| Coverage threshold in CI | None | 65% global | **34% global** | 65% global | **40% global** | 65% global |
| E2E in CI | No | Smoke only | **No** | Smoke + import | **No** | Full suite |

> **Notes on variances:**
> - Test case count (809 vs projected 950) is lower because Phase 2b contexts and Phase 3 E2E import are not yet implemented. The hook tests exceeded estimates (57 cases vs 18-22 planned).
> - Coverage thresholds use a ratcheting strategy (raise floor each phase) rather than a fixed 65% target. The 40% floor will continue rising as remaining items are completed.
> - Context coverage remains 0% — `EncryptionContext` and `AuthContext` tests are the main remaining gap.
> - E2E in CI was deferred — Playwright smoke job not yet added.

---

## Existing Test Infrastructure (Reference)

### Frameworks & Tools
- **Unit:** Vitest + Testing Library (React) + jsdom
- **E2E:** Playwright (Chromium only)
- **Coverage:** @vitest/coverage-v8
- **CI:** GitHub Actions (`npm run check`)

### Test Utilities
- `src/test/setup.ts` â€” Global mocks (localStorage, sessionStorage, clipboard, matchMedia, IntersectionObserver, ResizeObserver)
- `src/test/test-utils.tsx` â€” MockAuthProvider, renderWithProviders, async helpers
- `src/test/factories.ts` â€” Type-safe factories for notes, tags, users, sessions, Supabase query builders
- `src/test/mocks/supabase.ts` â€” Full Supabase client mock with chainable query builder

### Test Files (Updated 2026-03-01)

**Components (12):** Auth, Editor, ShareModal, TagModal, HeaderShell, ChapteredLibrary, InstallPrompt, TagBadge, ErrorBoundary, **PassphraseSetup**, **PassphraseUnlock**, **ConflictModal**

**Hooks (7):** useInstallPrompt, useNetworkStatus, useShareTarget, **useIdleTimer**, **useSessionTimeout**, **useVaultSettings**, **useSessionSettings**

**Services (9+):** notes, notes_security, tags, syncEngine, encryption, exportImport, **encryptedNotes**, **offlineNotes**, **offlineTags**, **demoMigration**

**Utils (7+):** formatTime, sanitize, temporalGrouping, editorPosition, withRetry, exportImport, **validation**

> **Bold** = added during Phases 0-3.

---

## Codex Addendum (Main Branch, Risk-Based)

### Scope

- Branch: `main`
- Priority areas: `E2EE`, `offline/sync/conflicts`, `auth/session security`, `import/export`
- Objective: prioritize regression safety over raw coverage growth

### Evidence Snapshot (Re-Validated)

- Unit/component/service tests: **23 files, ~594 test cases** (`src/**/*.{test,spec}.{ts,tsx}`)
- E2E tests: **6 suites, ~76 cases** (`e2e/*.spec.ts`)
- High-risk modules with no direct tests:
  - Services: `offlineNotes.ts`, `offlineTags.ts`, `encryptedNotes.ts`, `demoMigration.ts`
  - Hooks: `useSyncEngine.ts`, `useSessionTimeout.ts`, `useSessionSettings.ts`, `useVaultSettings.ts`, `useIdleTimer.ts`
  - Contexts/security flows: `AuthContext.tsx`, `EncryptionContext.tsx`
  - App-level integration path: `App.tsx`
- CI currently runs only unit tests (`npm run test:run`) and does not run Playwright (`.github/workflows/ci.yml`).
- Auth-required E2E can be skipped when credentials are missing (`e2e/fixtures.ts`, `e2e/auth.spec.ts`).
- Import E2E does not test real file upload/import roundtrip (`e2e/export-import.spec.ts` comments at import tests).
- `syncEngine.test.ts` emphasizes helper/state outcomes and static source checks; push/pull/conflict integration behavior remains thin.

### Findings (Ordered by Risk to Product Quality)

#### P0: Regression gate can be green while critical user journeys are unverified

- Playwright is not in CI and auth E2E can auto-skip without failing the pipeline.
- Impact: silent regressions in sign-in, note CRUD, settings security flows, and sharing can reach `main`.

#### P0: Offline + encrypted sync pipeline has the largest blast radius and weakest protection

- Core path (`encryptedNotes -> offlineNotes/offlineTags -> syncEngine`) has no direct tests despite being the main data path.
- Impact: data loss, stuck pending queue, false conflict behavior, or decryption/sync corruption.

#### P1: Conflict-resolution and sync correctness are under-tested at behavior level

- Existing `syncEngine` tests strongly cover state helpers and mapping logic, but not enough end-to-end mutation/pull behavior with realistic queue + Dexie + Supabase mocks.
- Impact: conflict handling regressions and partial-sync edge cases can slip.

#### P1: Import safety net is incomplete at UI integration level

- Utility-level import/export coverage is strong, but E2E import validation stops before file upload/processing.
- Impact: regressions in real user import flow (parser wiring, UI state transitions, error messaging) can ship undetected.

#### P1: Session and vault security behavior lacks direct regression tests

- No direct tests for session timeout hooks/settings, vault auto-lock settings, re-auth workflow, and key lifecycle at context level.
- Impact: security regressions (keys/session persisting longer than intended, timeout UX drift, missed step-up auth).

#### P2: A few E2E checks are weak/no-op and reduce trust in suite signal

- Conditional assertion that can effectively do nothing when empty-state precondition is false.
- Unpin test has no final assertion to prove state changed.
- Impact: false confidence from passing tests without strong behavior guarantees.

### Updated Plan (Regression-First, Balanced)

#### Phase 0 (Immediate, 1-2 days): Strengthen CI Safety Net

- Add a small Playwright smoke job in CI for `auth -> create note -> export`.
- Make auth E2E skip explicit and failing in CI (or use dedicated CI credentials).
- Add coverage thresholds in Vitest (`global` + stricter floors for `src/services`, `src/contexts`, `src/hooks` high-risk files).

#### Phase 1 (Highest ROI, 3-5 days): Cover Core Offline/Encrypted Data Path

- Add integration-style unit tests with `fake-indexeddb` + Supabase mocks for:
  - `encryptedNotes.ts`
  - `offlineNotes.ts`
  - `offlineTags.ts`
  - `syncEngine.ts` (`processQueue`, `pullRemoteChanges`, conflict branches, retry cleanup)
- Focus on realistic user scenarios (offline create/update/delete, reconnect, conflict, retry exhaustion) rather than exhaustive branch micro-tests.

#### Phase 2 (Security + Session Reliability, 2-3 days)

- Add deterministic timer-based tests (`vi.useFakeTimers`) for:
  - `useSessionTimeout`, `useIdleTimer`, `useSessionSettings`, `useVaultSettings`
- Add context/component security tests for:
  - `EncryptionContext` key lock/unlock lifecycle
  - `AuthContext` sensitive action gating
  - `ReAuthModal` + `SessionTimeoutModal` behavior

#### Phase 3 (Import/Export Regression Hardening, 2 days)

- Add one full E2E import roundtrip using `setInputFiles` (JSON + Markdown).
- Add one integration test at App flow level to validate parsed import -> note creation mapping -> user feedback.

### Document Updates in v1.1

- Updated metadata (`Version`, `Last Updated`, reviewer attribution).
- Corrected unit test case count from `~622` to `~594` based on current `main`.
- Added this addendum with evidence-backed, risk-ranked findings.
- Added a tighter phased plan optimized for regression safety in your requested domains.

---

## Reviewer Reconciliation (v1.2)

### Where Both Reviewers Agreed (Strong Consensus)

- Offline encrypted sync pipeline is the **#1 launch risk** (both rated P0)
- `fake-indexeddb` is the right approach for integration-style unit tests
- Session/vault hooks need `vi.useFakeTimers` deterministic tests
- `syncEngine.ts` existing tests are state-heavy but behavior-light
- Coverage thresholds must be added to CI

### What Codex Added Beyond the Original Audit

| Finding | Assessment |
|---|---|
| `AuthContext.tsx` and `EncryptionContext.tsx` untested | Valid — original audit flagged the encryption *service* layer but missed the *contexts* that manage key lifecycle and auth state. Added to Phase 2b. |
| `App.tsx` integration path untested | Valid — App.tsx orchestrates passphrase gate, encryption wiring, and demo migration. Acknowledged but deferred to post-launch (testing top-level glue is high-effort, low-ROI vs testing the layers it calls). |
| E2E import tests stop before file upload | Sharp observation — 96 unit tests cover parsers but no E2E exercises the real `setInputFiles` flow. Added to Phase 3. |
| Weak/no-op E2E assertions (P2) | Good catch — conditional assertions that pass vacuously create false confidence. Added to Phase 0 as quick fix. |
| Phase 0 CI hardening first | Smart sequencing — harden the gate before adding tests behind it. Adopted as the leading phase. |
| Per-directory coverage thresholds | Better than flat global floor. Adopted: `services/` 75%, `contexts/` 70%, `hooks/` 60%, global 65%. |

### Count Discrepancy

Codex re-validated at ~594 test cases vs original estimate of ~622. The difference likely comes from counting methodology (Codex may have counted `it()` blocks more strictly). The merged plan uses ~670 as the baseline to be conservative.

### Document Updates in v1.2

- Merged Claude's tier-based plan with Codex's risk-ranked phases into unified **Phase 0–4** execution plan.
- Added detailed per-phase checklists with specific test scenarios.
- Added **Reviewer Reconciliation** section documenting agreements, Codex-unique findings, and how each was incorporated.
- Updated **Projected Outcomes** table with Phase 0–4 milestones including context coverage and E2E-in-CI progression.
- Replaced separate "Recommended Execution Order" with merged plan.

### Document Updates in v1.3

- Added **Implementation Progress** section at top with phase-by-phase status, current metrics, and remaining items.
- Updated **Current State at a Glance** table with post-implementation numbers (35 files, 809 cases).
- Marked completed checklist items (`[x]`) across Phases 0-3 with actual test counts and PR links.
- Updated **Projected Outcomes** table with actual results alongside projections.
- Updated **Test Files** inventory with 12 new test files added during implementation.
- Added implementation notes explaining deviations from plan (ratcheting thresholds vs fixed 65%, per-directory thresholds not adopted).

### Document Updates in v1.4

- Added **Post-Implementation Assessment** by Codex (GPT-5.3) with risk-ranked findings, improvements, and bottom-line summary.

---

## Post-Implementation Assessment — Codex (GPT-5.3)

Independent post-implementation review of testing coverage after Phases 0-3 merged to `main`.

### Findings (Highest Risk First)

| # | Risk | Finding | References |
|---|------|---------|------------|
| 1 | **High** | E2E is still not a CI gate. CI runs unit coverage only (`npm run test:coverage`) and has no Playwright job. | `ci.yml:64` |
| 2 | **High** | Critical auth E2E can silently skip when credentials are missing, reducing regression signal on login/logout/session flows. | `fixtures.ts:29`, `auth.spec.ts:5` |
| 3 | **Medium** | Import E2E remains partial — tests stop at menu visibility/dialog trigger and explicitly skip real upload/roundtrip. | `export-import.spec.ts:108`, `export-import.spec.ts:126` |
| 4 | **Medium** | Orchestration-layer coverage is still weak relative to risk. App/contexts/UI security wrappers are largely uncovered with no direct tests. | `App.tsx`, `AuthContext.tsx`, `EncryptionContext.tsx`, `useSyncEngine.ts`, `SettingsModal.tsx`, `SessionTimeoutModal.tsx`, `ReAuthModal.tsx` |
| 5 | **Low** | Minor hygiene: one suite is still intentionally skipped. | `useShareTarget.test.ts:7` |

### What Improved

- **Unit/integration suite is much stronger:** 35 files, 816 tests (809 passed, 7 skipped).
- **Coverage now clears configured thresholds** (`vite.config.ts:118`):
  - Statements 39.66% (threshold 38%)
  - Branches 36.66% (threshold 35%)
  - Functions 33.85% (threshold 32%)
  - Lines 41.14% (threshold 40%)
- **High-risk services are now substantially covered:**
  - `encryptedNotes.ts` ~96.7%
  - `offlineTags.ts` ~96.7%
  - `offlineNotes.ts` ~65.6%
  - `syncEngine.ts` ~66.1%
- **Session/vault hooks and E2EE entry components improved significantly:** `useSessionTimeout`, `useSessionSettings`, `useVaultSettings`, `useIdleTimer`, `PassphraseSetup`, `PassphraseUnlock`, `ConflictModal`.

### Bottom Line

> This is a clear step up from the earlier baseline, especially for offline/sync/E2EE service-level safety. Remaining risk is now mostly at the integration boundary (App/context wiring + CI E2E gate + true import E2E).

### Correlation with Remaining Items

| Codex Finding | Maps To | Status |
|---------------|---------|--------|
| #1 — E2E not a CI gate | Remaining Item #4 (Playwright smoke job) | Known gap, deferred to Phase 4 |
| #2 — Auth E2E silent skip | Phase 0 E2E hardening | Partially addressed in PR #142; credential provisioning is environment-dependent |
| #3 — Import E2E partial | Remaining Item #3 (E2E import roundtrip) | Known gap, planned |
| #4 — Orchestration-layer weak | Remaining Items #1-2 (EncryptionContext, AuthContext) | Partially planned; App.tsx, SettingsModal, SessionTimeoutModal, ReAuthModal are new additions |
| #5 — Skipped suite | Known | `useShareTarget` requires Share Target API not available in test environment |
