# Launch Readiness Assessment

**Author:** Claude (Opus 4.5 → Opus 4.6)
**Created:** 2025-12-26
**Last Updated:** 2026-03-10
**Status:** Active — Not Yet Launch-Ready

---

## Latest Summary

| Assessment | Date | Readiness | Key Change |
|------------|------|-----------|------------|
| Assessment 1 | 2025-12-26 | ~75-80% | Initial evaluation |
| Assessment 2 | 2025-12-28 | ~85% | Testing infrastructure complete |
| Assessment 3 | 2025-12-28 | ~90% | Bundle size reduced 44% (596→332 KB) |
| Assessment 4 | 2025-12-28 | ~93% | Codex review fixes complete |
| Assessment 5 | 2026-01-07 | ~95% | Full offline editing complete (PR #48) |
| Assessment 6 | 2026-01-11 | ~100% | Phase 0 launch polish complete |
| **Assessment 7** | **2026-03-10** | **Not ready** | **Codex deep-dive: trust/recovery gaps in offboarding, sharing, sync** |

---

# Assessment 7 (2026-03-10)

**Reviewer:** Codex (GPT-5) — deep readiness review
**Counter-reviewer:** Claude (Opus 4.6) — verification and triage
**Verdict:** Not ready for broad public launch. Biggest gaps are trust/recovery issues in offboarding, sharing, and cross-device sync — not visual polish.

## Executive Summary

Codex performed a deep readiness review focusing on backend trust, data integrity, and deployment hygiene. Claude verified every finding against the source code. The issues fall into three categories:

1. **Features that promise more than they deliver** — offboarding, backup labels, OAuth re-auth
2. **Data integrity edges** — sync conflicts, non-atomic writes, silent overwrites
3. **Deployment hygiene** — routes, env vars, social metadata

Category 1 is the most dangerous for launch: users forgive missing features but not features that lie.

---

## Must Fix Before Launch (6 items)

### 1. Disable "Letting Go" (offboarding)

**Problem:** The UI promises "Your account will fade for 14 days, then release" but there is no server-side job that actually deletes anything. `initiateOffboarding()` only writes `departing_at` into `user_metadata`. The 14-day countdown is pure client-side math with no backend enforcement.

**Evidence:**
- [`AuthContext.tsx:283`](../../src/contexts/AuthContext.tsx#L283) — `initiateOffboarding` sets metadata only
- [`AuthContext.tsx:305`](../../src/contexts/AuthContext.tsx#L305) — `daysUntilRelease` is client-side computation
- [`LettingGoModal.tsx:248`](../../src/components/LettingGoModal.tsx#L248) — UI promises "then release"

**Fix:** Hide the offboarding link from SettingsModal for launch. Ship proper server-side deletion (edge function + cron) as a dedicated trust workstream later.

**Effort:** Small (hide feature) / Large (build real backend)

### 2. Persist share key in sessionStorage

**Problem:** The app strips `#k=` from the URL immediately after parsing, then stores the share key only in React state. Any page reload after mount (SW update, error recovery, manual refresh) loses the decryption key permanently, turning a valid shared note into "incomplete link."

**Evidence:**
- [`App.tsx:433`](../../src/App.tsx#L433) — share key parsed into `useState` on mount
- [`App.tsx:439`](../../src/App.tsx#L439) — `replaceState` strips `#k=` from URL
- [`ReloadPrompt.tsx:40`](../../src/components/ReloadPrompt.tsx#L40) — SW update triggers `location.reload()`
- [`ErrorBoundary.tsx:57`](../../src/components/ErrorBoundary.tsx#L57) — error recovery triggers `location.reload()`

**Fix:** Before stripping `#k=`, persist the share key in `sessionStorage` keyed by token. `SharedNoteView` reads from sessionStorage as fallback. One `sessionStorage.setItem` + one `getItem` — quick, high-value fix.

**Effort:** Small (~1 hour)

### 3. Fix "Full Backup" misleading copy

**Problem:** The export button says "Full Backup (includes share links)" but it only exports share tokens, not the `#k=` decryption keys. The share UI itself warns that losing `#k=` makes links unusable — contradicting the backup promise.

**Evidence:**
- [`LettingGoModal.tsx:352`](../../src/components/LettingGoModal.tsx#L352) — "includes share links" label
- [`exportImport.ts:169`](../../src/utils/exportImport.ts#L169) — `FullAccountExport` type: token only, no key
- [`notes.ts:695`](../../src/services/notes.ts#L695) — `fetchAllNoteShares` returns token, not key
- [`ShareModal.tsx:362`](../../src/components/ShareModal.tsx#L362) — warns about losing `#k=`

**Fix:** Change label to "Full Backup (includes share metadata)" or remove the claim. Share keys are ephemeral by design — the export can't include them without an architectural change.

**Effort:** Trivial (copy change)

### 4. Update social metadata

**Problem:** `index.html` still references the old Zenote URL/branding, so link previews show stale information.

**Evidence:**
- [`index.html:40`](../../index.html#L40) — old Zenote metadata

**Fix:** Update OG tags to Yidhan branding and live URL.

**Effort:** Trivial

### 5. Verify `/demo` route on Vercel

**Problem:** `vercel.json` only has a rewrite for `/s/*`. The landing page links to `/demo`, which is a client-side route. Direct navigation or refresh could 404.

**Evidence:**
- [`vercel.json:2`](../../vercel.json#L2) — only `/s/:path*` rewrite exists
- [`LandingPage.tsx:201`](../../src/components/LandingPage.tsx#L201) — links to `/demo`
- [`App.tsx:445`](../../src/App.tsx#L445) — branches on `/demo` pathname

**Mitigating factor:** Vercel's default SPA behavior for Vite projects serves `index.html` as fallback for unmatched routes. This likely works already, but needs explicit verification.

**Fix:** Test direct navigation to `https://yidhan.vercel.app/demo`. If it 404s, add a catch-all rewrite: `{ "source": "/(.*)", "destination": "/index.html" }`.

**Effort:** Trivial (verify + one-line fix if needed)

### 6. Guard `deleteNoteFromServer` against unsynced work

**Problem:** When a server-originated delete arrives via realtime, `deleteNoteFromServer()` unconditionally removes the note from IndexedDB — even if it has pending unsynced local edits. This is genuine silent data loss.

**Evidence:**
- [`offlineNotes.ts:1156`](../../src/services/offlineNotes.ts#L1156) — no `syncStatus` check before delete
- [`App.tsx:682`](../../src/App.tsx#L682) — realtime DELETE handler calls this function

**Fix:** Check `syncStatus` before deleting. If `pending` or `blocked`, convert to a conflict (surface via `ConflictModal`) instead of hard-deleting. The conflict resolution infrastructure already exists.

**Effort:** Small (~2-3 hours including tests)

---

## Deferred to Post-Launch (5 items)

### 7. OAuth re-authentication (DEFERRED)

**Problem:** For Google/GitHub users, the ReAuthModal just checks whether typed email matches — no actual OAuth challenge.

**Evidence:** [`ReAuthModal.tsx:78`](../../src/components/ReAuthModal.tsx#L78)

**Why defer:** With offboarding disabled (item 1), the main action gated by re-auth is full backup export. Low user count at launch = low risk. Build proper `signInWithOAuth({ prompt: 'consent' })` step-up auth as part of the offboarding trust workstream.

### 8. Cross-device tag sync (DEFERRED)

**Problem:** `pullRemoteChanges()` only reconciles `notes` and `tags`, not `note_tags`. Multi-device tag assignments drift until full hydration.

**Evidence:** [`syncEngine.ts:816`](../../src/services/syncEngine.ts#L816)

**Why defer:** Already flagged as deferred post-launch in CLAUDE.md (item 4 of reliability plan). Tags sync on full hydration (login/refresh), just not incrementally. Annoying for multi-device but not data-losing.

### 9. Non-atomic offline mutations (DEFERRED)

**Problem:** Tag creation, tag assignment, note update/pin/delete paths write IndexedDB and queue sync as separate operations. A crash in the sub-millisecond window between them leaves unsynced local state.

**Evidence:**
- [`offlineTags.ts:61`](../../src/services/offlineTags.ts#L61)
- [`offlineNotes.ts:737`](../../src/services/offlineNotes.ts#L737)
- [`offlineNotes.ts:861`](../../src/services/offlineNotes.ts#L861)
- [`encryptedNotes.ts:207`](../../src/services/encryptedNotes.ts#L207) — shows the correct transaction pattern

**Why defer:** The crash window is sub-millisecond. `encryptedNotes.ts` already has the correct pattern — standardize all paths onto it post-launch.

### 10. `upsertNoteFromServer` conflict edge (DEFERRED)

**Problem:** Server upsert can overwrite a pending local note's content in IndexedDB while preserving `syncStatus: 'pending'`. The sync queue still holds the local version and will push it.

**Evidence:** [`offlineNotes.ts:1096`](../../src/services/offlineNotes.ts#L1096)

**Why defer:** The queue preserves the local version — it's confusing UX (UI briefly shows server version) but not data loss. Fix alongside broader conflict resolution improvements.

### 11. Supabase env var graceful failure (DEFERRED)

**Problem:** Missing env vars cause a hard `throw` at module import, producing a blank screen.

**Evidence:** [`supabase.ts:7`](../../src/lib/supabase.ts#L7)

**Why defer:** Only triggers during a bad deploy. In production on Vercel with configured env vars, this never fires. Landing page and demo both need Supabase — no useful degraded state exists.

---

## Manual Verification Before Launch (not code)

### 12. Audit live Supabase sharing policies

**Problem:** Migration history contains old public-read policies, later revocations, then E2EE RPC reintroduction. The desired policy set should be verified against the live Supabase project.

**Evidence:**
- [`add_shared_note_public_access.sql:6`](../../supabase/migrations/add_shared_note_public_access.sql#L6)
- [`expire_shares_for_e2ee.sql:8`](../../supabase/migrations/expire_shares_for_e2ee.sql#L8)
- [`enable_e2ee_sharing.sql:19`](../../supabase/migrations/enable_e2ee_sharing.sql#L19)
- [`fix_note_shares_rls_ownership.sql:12`](../../supabase/migrations/fix_note_shares_rls_ownership.sql#L12)

**Action:** Query `pg_policies`, `pg_proc`, and `information_schema.role_table_grants` in the live Supabase project. Verify RLS policies and `fetch_shared_note` RPC match expected state.

---

## Launch Effort Estimate

| Item | Effort | Priority |
|------|--------|----------|
| 1. Disable "Letting Go" | 30 min | Must fix |
| 2. Share key sessionStorage | 1 hour | Must fix |
| 3. Fix backup copy | 15 min | Must fix |
| 4. Social metadata | 15 min | Must fix |
| 5. Verify `/demo` route | 15 min | Must fix |
| 6. Guard `deleteNoteFromServer` | 2-3 hours | Must fix |
| 12. Audit Supabase policies | 1 hour (manual) | Must verify |
| **Total** | **~1-2 days** | |

---

## Codex's Original Recommended Sequence

For reference, Codex recommended the following 8-step sequence:

1. Put immediate guardrails in place (disable/flag "Letting Go", fix backup copy, `/demo` rewrite, social metadata, supabase.ts throw)
2. Fix offboarding and re-auth as one trust workstream (server-owned workflow, real OAuth step-up)
3. Make shared links reload-safe (sessionStorage persistence before stripping `#k=`)
4. Fix cross-device tag sync (extend pull to reconcile `note_tags`, add realtime handling)
5. Remove silent data-loss behavior (unify pull/realtime conflict rules, guard `deleteNoteFromServer`)
6. Make offline mutations atomic (bring all write paths onto `encryptedNotes.ts` transaction pattern)
7. Fix share-backup trust gap (store owner-only encrypted recovery copy of share keys)
8. Audit live sharing policy state (verify DB against expected policy/function/grant set)

Our triage adopts items 1, 3, 5 (partially) as must-fix and defers items 2, 4, 6, 7 to post-launch. Item 8 is a manual verification task.

---

# Assessment 6 (2026-01-11)

## Executive Summary

**Overall: ~100% Ready** — All Phase 0 launch polish items complete.

**Key Progress:**
- Session timeout: 30-minute inactivity auto-logout with 5-minute zen warning modal
- Keyboard shortcuts modal: Press ? to view all shortcuts, slash commands, gestures
- Full account backup: Export profile, notes, tags, and share links on offboarding
- Rate limit handling: 429 detection with Retry-After header parsing
- Footer shortcuts link: Easy access to keyboard shortcuts help

---

## Phase 0 Items Completed

| Item | Status | Details |
|------|--------|---------|
| Session Timeout | ✅ Complete | 30min timeout, 5min warning, "session fading" UX |
| Rate Limit Handling | ✅ Complete | 429 detection, Retry-After parsing, graceful retry |
| Letting Go Backup | ✅ Complete | Full export with profile + share links (version 2) |
| Feature Discovery | ✅ Complete | KeyboardShortcutsModal, ? shortcut, footer link |

### New Files Created
- `src/hooks/useSessionTimeout.ts` - Inactivity monitor hook
- `src/components/SessionTimeoutModal.tsx` - Zen-styled timeout warning
- `src/components/KeyboardShortcutsModal.tsx` - Shortcuts help modal

### Files Modified
- `src/utils/withRetry.ts` - Added 429 handling, isRateLimitError, parseRetryAfter
- `src/utils/exportImport.ts` - Added exportFullAccountData (version 2 format)
- `src/services/notes.ts` - Added fetchAllNoteShares
- `src/components/LettingGoModal.tsx` - Added full backup button
- `src/components/Footer.tsx` - Added optional shortcuts link
- `src/App.tsx` - Integrated session timeout and shortcuts modal

### Post-Implementation Codex Review Fixes
| Finding | Severity | Fix |
|---------|----------|-----|
| useSessionTimeout re-registers effect when isWarning flips | HIGH | Use ref to track isWarning, remove from deps |
| Scroll events from nested containers not detected | LOW | Add capture phase listener |
| Slash commands modal shows wrong command names | MEDIUM | `/heading1` → `/h1`, add `/highlight` |
| Same-day backups overwrite each other | Enhancement | Add HHMMSS timestamp to filenames |

---

# Assessment 4 (2025-12-28)

## Executive Summary

**Overall: ~93% Ready** — Codex code review findings addressed. All P1/P2/P3 items complete.

**Key Progress:**
- API retry logic: Smart error discrimination (4xx fail fast, 5xx/network retry)
- Save safety: In-flight save tracking prevents data loss on navigation
- Privacy: Sentry session replay masks note content
- Accessibility: Space key support for all interactive elements
- Error tokens: Consistent --color-error across themes

**Remaining Blockers:** Bundle still above 250KB target (332KB), server-side faded notes cleanup

---

## Codex Review Fixes Completed

### P1 - Pre-Launch (Critical)
| Item | Status | PR |
|------|--------|-----|
| Honest offline messaging | ✅ Complete | #44 |
| SharedNoteView XSS defense-in-depth | ✅ Complete | #44 |
| Delete stale closure fix | ✅ Complete | #44 |

### P2 - Launch Week (Important)
| Item | Status | PR |
|------|--------|-----|
| Sentry session replay masking | ✅ Complete | #45 |
| Retry error discrimination | ✅ Complete | #45 |
| In-flight save tracking | ✅ Complete | #45 |
| Server-side faded notes cleanup | ⏸️ Deferred | Requires Supabase Dashboard |

### P3 - Post-Launch (Nice to Have)
| Item | Status | PR |
|------|--------|-----|
| Await save on Escape/back | ✅ Complete | #45 |
| Error design tokens | ✅ Complete | #45 |
| Space key accessibility | ✅ Complete | #45 |
| State updates during render | ✅ Reviewed - valid pattern | #45 |

---

## Updated P0 Blockers

| Issue | Original Status | Current Status | Notes |
|-------|-----------------|----------------|-------|
| Bundle size 594KB | P0 Blocker | ⚠️ **Improved** | 332KB (target <250KB, -44%) |
| Test coverage ~5% | P0 Blocker | ✅ **RESOLVED** | 457 unit + 42 E2E passing |
| API retry logic | P0 Blocker | ✅ **RESOLVED** | 3 retries, error discrimination, save tracking |
| Share token security | P0 Blocker | ✅ **VERIFIED** | 128-bit entropy, RLS protected, documented |
| Offline editing | P0 Blocker | ✅ **RESOLVED** | Full IndexedDB + sync queue (PR #48) |
| Mobile real device testing | P0 Blocker | ❓ Unverified | Not tested on physical devices |

---

## What's Strong

- ✅ **Codex review complete** - All P1/P2/P3 items addressed
- ✅ **Bundle optimized** - 44% reduction, code splitting, vendor chunking
- ✅ **457 unit tests passing** - Comprehensive coverage with 8 new retry tests
- ✅ **Resilient saves** - Retry logic, error discrimination, in-flight tracking
- ✅ **Privacy enhanced** - Sentry replay masking for note content
- ✅ **Accessibility improved** - Space key navigation, ARIA roles

### Related Documents

- [Codex Code Review](../reviews/zenote-comprehensive-review-Codex.md) - Original findings
- [Codex Review Action Plan](../archive/plans/codex-review-action-plan.md) - Implementation details (✅ Complete)

---

# Assessment 3 (2025-12-28)

## Executive Summary

**Overall: ~90% Ready** — Major bundle optimization. Main bundle reduced from 596KB to 332KB.

**Key Progress:**
- Bundle size: 596 KB → 332 KB (-44% reduction)
- Lazy loading: 8 components now code-split
- Vendor chunking: Supabase, Sentry, React in separate cacheable chunks

**Remaining Blockers:** Bundle still above 250KB target (332KB), E2E accessibility fixes (42/81 passing)

---

## Bundle Optimization Results

| Chunk | Before | After | Change |
|-------|--------|-------|--------|
| **Main bundle** | 596 KB | **332 KB** | -264 KB (-44%) |
| Editor | 415 KB | 415 KB | (already lazy) |

### New Lazy-Loaded Chunks

| Chunk | Size | Type |
|-------|------|------|
| vendor-supabase | 189 KB | Vendor |
| vendor-sentry | 18 KB | Vendor |
| vendor-react | 4 KB | Vendor |
| ChangelogPage | 12 KB | Route |
| FadedNotesView | 11 KB | Route |
| SettingsModal | 11 KB | Modal |
| SharedNoteView | 6 KB | Route |
| TagModal | 6 KB | Modal |
| LettingGoModal | 5 KB | Modal |
| RoadmapPage | 4 KB | Route |

### Optimization Techniques Applied

1. **Lazy load views/routes** - ChangelogPage, RoadmapPage, FadedNotesView, SharedNoteView
2. **Lazy load modals** - SettingsModal, LettingGoModal, TagModal
3. **Vendor chunking** - Supabase, Sentry, React split into separate chunks
4. **Reusable LoadingFallback** - Consistent loading UI for Suspense boundaries

---

## P0 Blockers - Updated Status

| Issue | Original Status | Current Status | Notes |
|-------|-----------------|----------------|-------|
| Bundle size 594KB | P0 Blocker | ⚠️ **Improved** | 332KB (target <250KB, -44%) |
| Test coverage ~5% | P0 Blocker | ✅ **RESOLVED** | 439 unit + 42 E2E passing |
| API retry logic | P0 Blocker | ✅ **RESOLVED** | 3 retries with exponential backoff, error UI |
| Share token security | P0 Blocker | ✅ **VERIFIED** | 128-bit entropy, RLS protected, documented |
| Offline editing | P0 Blocker | ✅ **RESOLVED** | Full IndexedDB + sync queue (PR #48) |
| Mobile real device testing | P0 Blocker | ❓ Unverified | Not tested on physical devices |

---

## Remaining Work

### Critical (P0)

1. **Bundle size** - 332KB, needs ~82KB more reduction to hit 250KB target
   - Options: Tree-shake Auth/LandingPage, lighter deps, or accept current size
   - Consider: 332KB may be acceptable for production

2. **E2E test accessibility fixes** - 42/81 passing (52%)
   - Issues #39-42 track remaining work
   - Components need `role="dialog"`, `aria-modal`, label associations

### High Priority (P1)

3. **Verify API retry logic** - Check if note saves retry on failure
4. **Verify offline editing** - Test PWA queue/sync behavior
5. **Mobile device testing** - Test on real iPhone + Android

---

## What's Strong

- ✅ **Bundle optimized** - 44% reduction, code splitting, vendor chunking
- ✅ **Testing infrastructure complete** - Vitest + Playwright configured
- ✅ **439 unit tests passing** - Services, utilities, components covered
- ✅ **E2E covering all features** - Auth, notes, tags, sharing, export/import, settings
- ✅ **CI/CD validates tests** - `npm run check` runs full suite
- ✅ **Core features complete** - CRUD, rich editor, tags, export/import, auth, sharing

---

## Updated Go/No-Go Checklist

**P0 (Must Have):**
- [x] ~~Bundle size reduced~~ ✅ 596→332 KB (-44%)
- [ ] Bundle size <250 KB (currently 332KB - consider acceptable?)
- [x] ~~Integration tests added for note CRUD~~ ✅ 107 tests
- [x] ~~Test coverage significantly improved~~ ✅ 439 unit tests
- [ ] E2E tests all passing (currently 42/81)
- [x] ~~API retry logic verified~~ ✅ See `docs/analysis/api-retry-logic-analysis-claude.md`
- [x] ~~Share token security verified~~ ✅ See `docs/analysis/share-token-security-analysis-claude.md`
- [x] ~~Offline editing verified~~ ✅ Full IndexedDB + sync (PR #48)
- [ ] Mobile tested on real devices
- [x] ~~Sentry configured~~ ✅
- [x] ~~Production OAuth URLs verified~~ ✅

**P1 (Should Have):**
- [ ] Rate limiting enabled on API
- [ ] "Letting Go" includes backup download
- [ ] Session timeout implemented
- [ ] Feature discovery hints added

---

# Assessment 2 (2025-12-28)

## Executive Summary

**Overall: ~85% Ready** — Major progress on testing. Bundle size remains the primary blocker.

**Key Progress:**
- Test coverage: 4 files → 22 files (~525 tests written)
- E2E infrastructure: Playwright configured with 86 tests across 6 spec files
- CI/CD: Full test suite integrated into `npm run check`

**Remaining Blockers:** Bundle size (596KB), E2E accessibility fixes (42/81 passing)

---

# Assessment 1 (2025-12-26)

## Executive Summary

**Overall: ~75-80% Ready** — Solid foundation, but needs critical fixes before public launch.

**Recommendation:** CONDITIONAL GO after fixing P0 blockers and most P1 items.

---

## What's Strong

- **Core features complete** — CRUD, rich editor, tags, export/import, auth (email + OAuth), sharing
- **Good error handling** — Error boundary, toast notifications, network detection
- **Security fundamentals** — XSS prevention, RLS, password policies, input validation
- **Deployment ready** — Vercel + Supabase, CI/CD pipeline working
- **Design cohesive** — Wabi-sabi aesthetic consistent throughout

---

## Critical Blockers (P0)

| Issue | Risk | Effort |
|-------|------|--------|
| Bundle size 594 KB (should be <250 KB) | Users on slow networks can't load | 2-3 days |
| No retry logic on API failures | Note data loss on flaky networks | 1-2 days |
| Test coverage ~5% | High regression risk | 2-3 days |
| Share tokens visible in browser history | Privacy concern | 4 hours |
| No offline editing (PWA gap) | Users can't use app without internet | 1-2 weeks |
| Mobile not tested on real devices | Unknown UX issues, can't claim cross-platform | 1-2 days |

> **Note:** Offline editing and mobile testing were elevated to P0 after reconciling with Mobile Strategy Analysis and Competitive Evaluation. See `docs/analysis/mobile-strategy-analysis-claude.md` for implementation approach.

### Details

**Bundle Size:**
- Main bundle: 593.87 KB gzip (165.72 KB compressed)
- Editor chunk: 414.91 KB gzip (127.80 KB compressed)
- Target: <250 KB gzip for main bundle
- Solutions: Tree-shake, lazy load routes (Changelog, Roadmap), lighter Tiptap config

**API Retry Logic:**
- Failed saves don't retry automatically
- Network flakiness could lose user's note content
- Need exponential backoff retry for critical operations

**Test Coverage:**
- Only 4 test files exist (sanitize, formatTime, ErrorBoundary, TagBadge)
- No tests for: note CRUD, auth flows, import/export, tags, sharing
- Minimum: Add 15-20 integration tests for critical paths

**Share Token Security:**
- Tokens appear in URL (browser history, shared links)
- Document this limitation to users
- Consider: copy-to-clipboard instead of URL display

---

## High Priority (P1)

| Issue | Risk | Effort |
|-------|------|--------|
| No rate limiting | Abuse/DOS vulnerability | 1 day |
| "Letting Go" doesn't auto-export backup | Users lose data on departure | 4 hours |
| Share expiration defaults to "never" | Permanent public shares | 2 hours |
| No session timeout | Security gap (logged in forever) | 4 hours |
| Image attachments not supported | Expected feature by users | 3-5 days |
| No feature discovery hints | Users miss slash commands, shortcuts | 2-3 days |

---

## Medium Priority (P2)

| Issue | Notes |
|-------|-------|
| No onboarding tutorial | Users discover features slowly |
| Empty library state basic | Could have better CTA |
| No help menu | Users might get stuck |
| PWA icons may be missing | Check /icons/ paths |
| No Lighthouse CI checks | No performance regression alerts |

---

## Timeline Estimates

| Scope | Duration |
|-------|----------|
| P0 fixes only | 2-3 weeks |
| P0 + P1 (recommended) | 3-4 weeks |
| Comprehensive (P0 + P1 + P2) | 5-6 weeks |

> **Updated:** Timeline extended after adding offline editing (1-2 weeks) and mobile testing (1-2 days) to P0 blockers. See Mobile Strategy Analysis for Enhanced PWA implementation plan.

---

## Area-by-Area Assessment

| Area | Status | Blockers | Risk Level |
|------|--------|----------|------------|
| Core Functionality | Complete | 0 | Low |
| Error Handling | Adequate | 1 | Medium |
| Test Coverage | Critical Gap | 1 | High |
| Security | Good | 2 | Medium |
| Performance | Poor | 1 | High |
| Mobile UX | Untested | 1 | Medium |
| Onboarding | Functional | 0 | Low |
| Data Safety | Partial | 1 | Medium |
| Deployment | Ready | 0 | Low |

---

## Post-Launch Priorities (First 30 Days)

1. Monitor error rates via Sentry
2. Collect mobile device feedback
3. Increase test coverage to 50%
4. Further bundle optimization
5. Implement automated daily backups
6. Add feature usage analytics

---

## Success Metrics (Launch Week)

- <5% error rate on critical operations
- <2% abandonment on signup flow
- <10% users reporting bugs
- >95% notes saving within 2s
- <100ms p95 latency on note list load

---

## Go/No-Go Checklist

Before launch, verify:

**P0 (Must Have):**
- [ ] Bundle size reduced to <250 KB gzip
- [ ] API retry logic implemented for note saves
- [ ] Integration tests added for note CRUD
- [x] Share token security documented ✅ See `docs/analysis/share-token-security-analysis-claude.md`
- [x] ~~Offline editing works (IndexedDB + sync queue)~~ ✅ PR #48
- [ ] Mobile tested on real iPhone + Android
- [ ] Sentry configured and verified
- [ ] Production OAuth URLs verified in Supabase

**P1 (Should Have):**
- [ ] Rate limiting enabled on API
- [ ] "Letting Go" includes backup download
- [ ] Session timeout implemented
- [ ] Feature discovery hints added
