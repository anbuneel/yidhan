# Yidhan — Unified Product Roadmap

**Version:** 1.0
**Last Updated:** 2026-03-03
**Status:** Living Document
**Author:** Claude (Opus 4.6)

---

## Original Prompt

> Consolidate all planned features scattered across 8+ docs (PRD, strategic review, competitive plan, editor evaluation, quiet intelligence, subscription architecture, landing page redesign, launch readiness) into a single unified roadmap.

---

## How to Read This Document

- **Phases** are strategic priorities — work top-down
- **Feature area tags** show what part of the product is affected
- **Source docs** link to the detailed analysis/plan for each item
- **Status key:** `done` · `planned` (plan/design exists) · `proposed` (discussed, no plan yet) · `exploring` (idea stage)
- Items marked `done` are included for completeness — they show what's been accomplished

### Feature Area Tags

| Tag | Scope |
|-----|-------|
| `editor` | Writing experience, toolbar, formatting |
| `ai` | Quiet Intelligence suite, LLM features |
| `platform` | Mobile, native, PWA, distribution |
| `growth` | Sharing, public features, conversion |
| `infra` | Subscriptions, payments, backend |
| `ux` | Design, onboarding, polish |

---

## Phase 0: Foundation (Complete)

*Core product features that are shipped and stable.*

| Feature | Area | Status | Version | Source |
|---------|------|--------|---------|--------|
| Rich text editor (Tiptap) | `editor` | done | v1.0 | — |
| Tags + temporal chapters | `ux` | done | v1.0 | — |
| Email + Google + GitHub OAuth | `platform` | done | v1.0 | — |
| Export/Import (JSON, Markdown) | `platform` | done | v1.0 | — |
| Share as Letter (static) | `growth` | done | v1.2 | — |
| Faded Notes (soft-delete) | `ux` | done | v1.3 | — |
| Letting Go (offboarding) | `ux` | done | v1.4 | — |
| Offline editing + sync | `platform` | done | v2.0 | [strategic review](active/strategic-viability-review-claude.md) |
| Conflict resolution (Two Paths) | `platform` | done | v2.0 | — |
| Practice Space (/demo) | `growth` | done | v2.1 | [demo page design](analysis/frontend-skill-demo-writing-page-claude.md) |
| Mobile native feel (swipe, pull-to-refresh) | `platform` | done | v2.5 | [pwa-native-feel-plan](plans/pwa-native-feel-plan.md) |
| Session timeout | `ux` | done | v2.7 | [launch readiness](active/launch-readiness-assessment.md) |
| Editor quick wins (gold caret, slash icons, animated placeholder, mobile overflow toolbar) | `editor` | done | v2.8 | [editor evaluation](analysis/editor-ux-evaluation-claude.md) |
| End-to-end encryption (Argon2id + AES-256-GCM) | `infra` | done | v3.0 | [e2ee plan](plans/e2ee-implementation-plan.md) |
| Vault lock + auto-lock timer | `ux` | done | v3.1 | [vault unlock plan](plans/vault-unlock-ux-implementation-plan.md) |
| Remember this browser | `ux` | done | v3.4 | — |
| Testing expansion (830 tests) | `infra` | done | v3.4 | — |
| Share as Letter (E2EE) | `growth` | done | v3.5 | [share plan](archive/plans/share-as-letter-implementation-plan.md) |

---

## Phase 1: Ship Ready

*Low-effort items that polish the product before any marketing push. Do these first.*

### Next Sprint: Editor Excellence (~1 week)

| # | Feature | Area | Status | Effort | Source |
|---|---------|------|--------|--------|--------|
| 1.1 | **Focus Mode** — Ctrl+Shift+F / triple-tap to strip away all chrome, dim everything except writing | `editor` | planned | 1-2 days | [focus mode plan](../../../.claude/plans/calm-honking-mist.md) |
| 1.2 | **Subtle page presence** — Writing canvas gradient effect, custom caret refinements | `editor` | proposed | 1 day | [editor evaluation](analysis/editor-ux-evaluation-claude.md) |
| 1.3 | **Bottom toolbar on mobile** — Move formatting to bottom of screen (thumb zone) | `editor` | proposed | 3 days | [editor evaluation](analysis/editor-ux-evaluation-claude.md) |

### Other Ship Ready Items

| # | Feature | Area | Status | Effort | Source |
|---|---------|------|--------|--------|--------|
| 1.4 | **Landing Page Redesign** — Remove inline demo, surface Practice Space CTA, add trust signals | `growth` | planned | ~3 hours | [landing redesign](analysis/landing-page-redesign-unified-demo-claude.md) |
| 1.5 | **Update roadmap.ts** — Mark shipped features as done, sync with this doc | `infra` | proposed | 30 min | — |
| 1.6 | **Mobile real device testing** — Verify on iPhone SE, iPhone 15, Samsung Galaxy | `platform` | proposed | 1-2 days | [launch readiness](active/launch-readiness-assessment.md) |
| 1.7 | **App icon + OG image** — Branding assets needed for marketing, social sharing | `ux` | proposed | 1-2 days | [strategic review](active/strategic-viability-review-claude.md) |

---

## Phase 2: Table Stakes

*Features users expect from any modern note-taking app. Removes switching barriers.*

| # | Feature | Area | Status | Effort | Source |
|---|---------|------|--------|--------|--------|
| 2.1 | **Image Attachments** — Drag-and-drop images, screenshots, diagrams into notes. Supabase Storage, image compression, storage quota | `editor` | proposed | 2-3 weeks | [strategic review](active/strategic-viability-review-claude.md), [competitive plan](active/competitive-growth-plan-claude.md) |
| 2.2 | **Virtual Scrolling** — Smooth performance for large note collections via windowed rendering | `ux` | proposed | 1-2 weeks | roadmap.ts #5 |
| 2.3 | **Quick Capture** — Keyboard shortcut or widget for instant note creation from anywhere | `platform` | proposed | 1-2 weeks | [competitive plan](active/competitive-growth-plan-claude.md) |

---

## Phase 3: Differentiation

*Unique features no competitor offers. This is the moat.*

### 3A: Editor Excellence

| # | Feature | Area | Status | Effort | Source |
|---|---------|------|--------|--------|--------|
| 3.1 | **Typewriter Mode** — Keep current line vertically centered, smooth scroll as you type | `editor` | proposed | 1 week | [editor evaluation](analysis/editor-ux-evaluation-claude.md) |
| 3.2 | **Custom body font exploration** — Replace Inter with Literata or Source Serif 4 for warmer feel | `editor` | proposed | 1 week | [editor evaluation](analysis/editor-ux-evaluation-claude.md) |
| 3.3 | **Writing session stats** — Subtle word/character count on hover, optional writing time | `editor` | proposed | 3 days | [editor evaluation](analysis/editor-ux-evaluation-claude.md) |

### 3B: Quiet Intelligence (AI)

*"Help me remember what matters" — not generate more content.*

| # | Feature | Area | Status | Effort | Source |
|---|---------|------|--------|--------|--------|
| 3.4 | **Quiet Tasks** — Surface explicit checkboxes + implicit intentions ("I should...", "need to...") from notes. Server-side extraction via PostgreSQL regex | `ai` | planned | 3-4 weeks | [quiet tasks plan](plans/quiet-tasks-implementation-plan.md) |
| 3.5 | **Daily Whisper** — Personalized quote/thought based on writing themes, shown on app open | `ai` | proposed | 2-3 weeks | [competitive plan](active/competitive-growth-plan-claude.md) |
| 3.6 | **Weekly Digest Email** — Extracted to-dos, writing patterns, reflection prompts delivered to inbox | `ai` | proposed | 3-4 weeks | [quiet intelligence](analysis/quiet-intelligence-features-claude.md) |
| 3.7 | **Resonance Threads** — Connect related thoughts written months apart | `ai` | proposed | 4-6 weeks | [quiet intelligence](analysis/quiet-intelligence-features-claude.md) |
| 3.8 | **Seasonal Echo** — "This time last year..." reflections surfaced on anniversary dates | `ai` | proposed | 2-3 weeks | [quiet intelligence](analysis/quiet-intelligence-features-claude.md) |
| 3.9 | **Quiet Questions** — Reflection prompts drawn from your own writing | `ai` | proposed | 2-3 weeks | [quiet intelligence](analysis/quiet-intelligence-features-claude.md) |
| 3.10 | **The Convergence** — Notice when multiple themes in your life are aligning | `ai` | proposed | 4-6 weeks | [quiet intelligence](analysis/quiet-intelligence-features-claude.md) |
| 3.11 | **Gentle Grounding** — Awareness of emotional tone shifts across notes | `ai` | proposed | 4-6 weeks | [quiet intelligence](analysis/quiet-intelligence-features-claude.md) |
| 3.12 | **The Unsaid** — Notice themes that have quietly faded from your writing | `ai` | proposed | 4-6 weeks | [quiet intelligence](analysis/quiet-intelligence-features-claude.md) |

### 3C: Infrastructure for Intelligence

| # | Feature | Area | Status | Effort | Source |
|---|---------|------|--------|--------|--------|
| 3.13 | **Subscription system** — Bloom tier ($4/mo), LemonSqueezy integration, `subscriptions` table, `SubscriptionContext`, `FeatureGate` component | `infra` | planned | 2-3 weeks | [subscription architecture](analysis/subscription-architecture-claude.md) |

---

## Phase 4: Growth

*Features that bring in new users and expand the product's reach.*

| # | Feature | Area | Status | Effort | Source |
|---|---------|------|--------|--------|--------|
| 4.1 | **Public Garden** — Toggle notes as public to create a minimal blog at your own URL. No analytics, no comments. Growth loop: write → publish → share → discover → signup | `growth` | proposed | 2-3 weeks | roadmap.ts #6, [competitive plan](active/competitive-growth-plan-claude.md) |
| 4.2 | **Live Shared Letters** — Shared links that stay in sync with the original note. Edits reflect automatically via realtime subscription on encrypted channel | `growth` | proposed | 3-4 weeks | roadmap.ts #10 |
| 4.3 | **Additional OAuth** — Apple Sign-In and other providers | `platform` | proposed | 1 week | roadmap.ts #7, [oauth analysis](analysis/oauth-providers-analysis-claude.md) |
| 4.4 | **App Store Distribution** — Native Android (Play Store, $25), iOS (App Store, $99/yr, requires macOS) via Capacitor | `platform` | proposed | 4-6 weeks | roadmap.ts #9, [capacitor plan](plans/capacitor-implementation-plan.md) |
| 4.5 | **Usage Analytics** — Privacy-respecting writing habit insights for users | `ai` | proposed | 2-3 weeks | roadmap.ts #8 |

---

## Not Building (Intentional Omissions)

*Features we've explicitly decided against. These preserve the "quiet" philosophy.*

| Feature | Why Not | Source |
|---------|---------|--------|
| Databases / tables | That's Notion's game | [strategic review](active/strategic-viability-review-claude.md) |
| Graph view / backlinks | That's Obsidian's game | [strategic review](active/strategic-viability-review-claude.md) |
| Real-time collaboration | That's Notion/Craft's game. Single-user only is a design choice | [collaboration analysis](analysis/collaboration-feature-analysis-claude.md) |
| Folders / hierarchy | Contradicts temporal chapters philosophy | [strategic review](active/strategic-viability-review-claude.md) |
| Push notifications | Contradicts calm technology philosophy | — |
| Gamification | Contradicts wabi-sabi philosophy | — |
| Floating selection toolbar | Feels out of place with Yidhan's calm, static aesthetic — works for Notion/Medium but not for a quiet journal | [editor evaluation](analysis/editor-ux-evaluation-claude.md) |

---

## Summary Stats

| Category | Count |
|----------|-------|
| Phase 0 (done) | 17 features shipped |
| Phase 1 (ship ready) | 7 items (3 editor sprint + 4 other) |
| Phase 2 (table stakes) | 3 items |
| Phase 3 (differentiation) | 13 items (3 editor + 9 AI + 1 infra) |
| Phase 4 (growth) | 5 items |
| **Total remaining** | **28 items** |
| Items with plans/designs written | 5 (Focus Mode, Landing Redesign, Quiet Tasks, Subscription, E2EE sharing plan) |
| Not building | 7 intentional omissions |

---

## Open GitHub Issues

For tracking: #121, #122, #125, #129-#133, #138-#141, #143, #145, #146, #150

---

## Related Documents

### Strategy
- [Strategic Viability Review](active/strategic-viability-review-claude.md) — Honest competitive assessment
- [Competitive Growth Plan](active/competitive-growth-plan-claude.md) — Growth strategy
- [Launch Readiness Assessment](active/launch-readiness-assessment.md) — Launch checklist
- [Monetization Philosophy](active/monetization-philosophy.md) — Pricing approach

### Feature Design
- [Quiet Intelligence Features](analysis/quiet-intelligence-features-claude.md) — Full AI feature suite (12 scenarios)
- [Quiet Tasks Implementation Plan](plans/quiet-tasks-implementation-plan.md) — First AI feature, server-side arch
- [Subscription Architecture](analysis/subscription-architecture-claude.md) — Bloom tier, payments, webhooks
- [Editor UX Evaluation](analysis/editor-ux-evaluation-claude.md) — Editor improvements (15 items, 5 done)
- [Landing Page Redesign](analysis/landing-page-redesign-unified-demo-claude.md) — Unified demo strategy

### Platform
- [Mobile Implementation Review](analysis/mobile-implementation-review-claude.md) — Current state 8.5/10
- [Capacitor Implementation Plan](plans/capacitor-implementation-plan.md) — Native app setup
- [iOS Native Competitive Analysis](analysis/ios-native-competitive-analysis-claude.md) — Bear, Craft, Apple Notes

---

*This document supersedes feature lists in `roadmap.ts`, `prd.md` (Planned Features section), `competitive-growth-plan-claude.md` (priority order), and `strategic-viability-review-claude.md` (next steps). Those docs remain valid for context but this is the canonical feature backlog.*
