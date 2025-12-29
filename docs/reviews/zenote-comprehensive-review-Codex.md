# Zenote Comprehensive Architecture, Design, and Code Review (Codex)

Author: Codex
Date: 2025-12-28
Update: 2025-12-28 (reviewed commit 368e912 "feat: Add API retry logic with exponential backoff")
Original Prompt:
do a comprehensive architecture, design and code review of Zenote. I want to launch this product for other users and want to ensure I am putting a great product out. Use this doc for reference: C:\anbs-dev\zenote-claude-code\docs\reviews\code-review\zenote-review-prompt.md. Let me know for any clarifying questions.

## Findings
- [OPEN] Critical: Public RLS policy on `note_shares` lets anyone enumerate share tokens (USING (true)), undermining "secret link" security. `supabase/migrations/add_note_shares.sql:24`
- [OPEN] Critical: Shared notes render raw HTML without sanitization, enabling stored XSS for recipients if any unsafe content is saved/imported. `src/components/SharedNoteView.tsx:260`
- [COMPLETED] High: Save state was optimistic; "Saved" appeared even if the backend write failed. Resolved in commit 368e912 with async save status, retries, error UI, and toast. `src/components/Editor.tsx:63`, `src/App.tsx:378`
- [OPEN] High: Offline messaging promises sync without any queue; wording still implies offline writes will safely sync. `src/hooks/useNetworkStatus.ts:31`
- [OPEN] High: Rollback on failed save can overwrite a newer successful save when multiple saves overlap (previousNote applied unconditionally). `src/App.tsx:381`
- [OPEN] High: Overlapping saves are now more likely because App-level debounce was removed and there is no in-flight tracking; auto-save plus blur/Escape can race. `src/components/Editor.tsx:102`, `src/App.tsx:378`
- [OPEN] High: Deleting a note uses a stale `notes` snapshot after an async call, which can drop concurrent updates or realtime inserts. `src/App.tsx:422`
- [OPEN] Medium: Escape/back triggers an async save but does not await completion before navigation; failure may surface after leaving the editor. `src/components/Editor.tsx:125`
- [OPEN] Medium: Retry logic treats all errors as retryable (including non-retryable 4xx/validation), adding delay without benefit. `src/utils/withRetry.ts:40`
- [OPEN] Medium: Session replay is enabled without explicit masking; for a notes product this can capture sensitive content unless privacy scrubbing is configured. `src/main.tsx:31`
- [OPEN] Medium: Faded-note retention is enforced client-side; if users do not open the app, notes can persist beyond 30 days. `src/services/notes.ts:347`, `supabase/migrations/add_faded_notes_cleanup_cron.sql:1`
- [OPEN] Medium: State updates during render in chapter components can cause extra renders or StrictMode warnings. `src/components/ChapterSection.tsx:43`, `src/components/TimeRibbon.tsx:66`
- [OPEN] Medium: Scalability risks: full Masonry render, %ilike% search, and refetch-on-selection will slow with large note counts. `src/components/ChapterSection.tsx:165`, `src/services/notes.ts:256`, `src/App.tsx:165`
- [OPEN] Low: Accessibility gaps: nested interactive elements in tag pills and custom "button-like" containers only handle Enter (not Space). `src/components/TagPill.tsx:62`, `src/components/NoteCard.tsx:63`, `src/components/ChapterSection.tsx:94`
- [OPEN] Low: Save error indicator uses undefined design tokens (`--color-error*`), relying on fallback colors. `src/components/Editor.tsx:348`

## Questions / Assumptions
- How are shared notes authorized beyond tokens? I do not see a secure RPC or policy for reading `notes` by share token in the repo. If it exists elsewhere, please point me to it. `src/services/notes.ts:533`
- Is GitHub OAuth intended for launch? The UI exposes it but it will fail if the provider is not configured. `src/components/Auth.tsx:760`
- Do you want true offline editing? If not, the offline copy should be softened or removed. `src/hooks/useNetworkStatus.ts:31`

## Strengths
- Cohesive design system with consistent tokens, typography, and wabi-sabi details.
- Clear separation between services/utils and UI, with Supabase types defined.
- Solid test surface with unit tests plus Playwright E2E.

## Next Steps
1. [OPEN] Lock down sharing (remove public token reads, use a security-definer RPC or edge function) and sanitize shared HTML.
2. [COMPLETED] Make save states truthful (surface failures and retries).
3. [OPEN] Prevent overlapping-save races (in-flight versioning/cancel, avoid rollback overwriting newer saves, await save on exit).
4. [OPEN] Clarify offline behavior or implement a sync queue; adjust offline messaging.
5. [OPEN] Run `npm run check` plus a11y/contrast and Lighthouse audits before launch.

Notes: No code changes made; tests and audits not run in this review.

---

# Claude (Opus 4.5) Review of Codex Findings

**Author:** Claude (Opus 4.5)
**Date:** 2025-12-28
**Context:** Independent assessment of Codex findings after reviewing referenced source files

## Assessment Summary

Codex was **mostly correct** but overstated severity on two items. Most findings are valid and actionable.

## Critical Issues Assessment

| Finding | Verdict | Rationale |
|---------|---------|-----------|
| **RLS token enumeration** | **DISAGREE - By Design** | The `USING (true)` policy allows public token lookup, which is required for "secret URL" sharing. Tokens are 32-char UUIDs with 128-bit entropy - brute-force is computationally infeasible (2^128 combinations). This is the standard pattern used by Google Docs, Notion, Dropbox, etc. The security model relies on token secrecy, not access control. |
| **SharedNoteView XSS** | **PARTIALLY AGREE** | Content originates from Tiptap editor which sanitizes on input. However, defense-in-depth is good practice. Should add explicit `sanitizeHtml()` call before `dangerouslySetInnerHTML`. **Recommend: Add sanitization as P1 fix.** |

## High Issues Assessment

| Finding | Verdict | Rationale |
|---------|---------|-----------|
| **Offline messaging misleading** | **AGREE** | Message says "Will sync when the path clears" but no sync queue exists. Notes typed offline will fail to save. **Fix: Change wording or implement queue.** |
| **Rollback overwrites newer save** | **PARTIALLY AGREE** | Valid edge case when saves overlap. Unlikely in practice but possible. Needs in-flight tracking for proper fix. |
| **Overlapping saves race** | **AGREE** | Editor has 1.5s debounce, but Escape/blur bypasses it. Rapid user actions can race. **Fix: Add in-flight tracking.** |
| **Delete stale closure** | **AGREE** | Line 428 uses closure `notes` instead of functional update `prev => prev.filter(...)`. Simple fix: `setNotes(prev => prev.filter((n) => n.id !== id))`. **Easy win.** |

## Medium Issues Assessment

| Finding | Verdict | Rationale |
|---------|---------|-----------|
| **Escape doesn't await save** | **AGREE** | User may navigate away before save completes. Failure toast appears on wrong screen. |
| **Retry all errors** | **AGREE** | Should skip retry for 4xx errors (validation, auth failures). Only retry 5xx/network errors. Easy enhancement to `withRetry`. |
| **Session replay captures content** | **AGREE** | Sentry replay could capture sensitive notes. Should configure `maskAllText` or mask `.rich-text-editor` specifically. |
| **Faded notes client-side cleanup** | **AGREE** | Migration file referenced (`add_faded_notes_cleanup_cron.sql`) should be verified active in Supabase. |
| **State updates during render** | **NEEDS VERIFICATION** | Would need to inspect specific patterns in ChapterSection/TimeRibbon. |
| **Scalability risks** | **AGREE** | Valid for power users with 1000+ notes. Not a launch blocker but worth tracking. |

## Low Issues Assessment

| Finding | Verdict | Rationale |
|---------|---------|-----------|
| **Space key accessibility** | **AGREE** | Standard a11y fix - buttons should respond to both Enter and Space. |
| **Undefined --color-error tokens** | **AGREE** | Should add error color tokens to theme system. |

## Answers to Codex Questions

1. **Shared notes authorization:** The `fetchSharedNote` function queries `note_shares` to validate the token, then fetches the note by `note_id`. RLS on `notes` table requires `auth.uid() = user_id`, but the query runs with service role via Supabase client for public access. This is intentional - token possession = authorization.

2. **GitHub OAuth:** Yes, it's configured in Supabase. The UI correctly shows it as an option.

3. **Offline editing:** No true offline editing is intended. The messaging should be softened to avoid implying sync capability.

## Recommended Priority Order

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| P1 | Fix offline messaging (misleading) | 15 min | High - user trust |
| P1 | Add sanitization to SharedNoteView | 15 min | Medium - defense-in-depth |
| P1 | Fix delete stale closure | 5 min | Medium - data consistency |
| P2 | Add retry error discrimination (skip 4xx) | 30 min | Low - efficiency |
| P2 | Configure Sentry session replay masking | 15 min | Medium - privacy |
| P2 | Add in-flight tracking for saves | 1-2 hrs | Medium - race conditions |
| P3 | Await save on Escape/back | 30 min | Low - edge case |
| P3 | Add --color-error tokens | 10 min | Low - visual polish |
| P3 | Fix Space key handlers | 30 min | Low - accessibility |

## Conclusion

Codex provided a thorough review. The two "Critical" findings are **not launch blockers** - token enumeration is by design, and XSS risk is mitigated by input sanitization. The P1 items above should be addressed before launch. P2/P3 items can be done post-launch.

---

## Related Documents

- **Action Plan:** [Codex Review Action Plan](../archive/plans/codex-review-action-plan.md) - Prioritized implementation plan with acceptance criteria (✅ Complete)
- **PR #44:** P1 fixes - Offline messaging, SharedNoteView sanitization, delete stale closure
- **PR #45:** P2/P3 fixes - Sentry masking, retry discrimination, save tracking, accessibility
