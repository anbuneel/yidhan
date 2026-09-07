# Roadmap

What is deferred, and what is refused. Nothing here is approved work.

**Entries are candidates, not commitments.** Approval happens by writing a plan in
`docs/plans/` and marking it `Status: ACTIVE` — not by appearing in this table. An
item can sit here indefinitely without that meaning anything is owed.

Shipped work is **not** listed here; `docs/progress.md` owns history and
`src/data/changelog.ts` is the user-facing release surface. Reasoning behind
architectural choices belongs in `DECISIONS.md`.

**Update trigger:** an outcome is deferred, or refused.

### How to read it

- **Phases** are strategic priorities, worked top-down.
- **Status:** `planned` (a plan or design exists) · `proposed` (discussed, no plan)
  · `exploring` (idea stage).
- **Effort** is a rough order of magnitude, not an estimate.

### Feature area tags

| Tag | Scope |
|-----|-------|
| `editor` | Writing experience, toolbar, formatting |
| `ai` | Quiet Intelligence suite, LLM features |
| `platform` | Mobile, native, PWA, distribution |
| `growth` | Sharing, public features, conversion |
| `infra` | Subscriptions, payments, backend |
| `ux` | Design, onboarding, polish |

---

## Phase 1: Ship Ready

*Low-effort items that polish the product before any marketing push. Do these first.*

| # | Feature | Area | Status | Effort |
|---|---------|------|--------|--------|
| 1.4 | **Landing Page Redesign** — Remove inline demo, surface Practice Space CTA, add trust signals | `growth` | planned | ~3 hours |
| 1.5 | **Update roadmap.ts** — Mark shipped features as done, sync with this doc | `infra` | proposed | 30 min |
| 1.6 | **Mobile real device testing** — Verify on iPhone SE, iPhone 15, Samsung Galaxy | `platform` | proposed | 1-2 days |
| 1.7 | **App icon + OG image** — Branding assets needed for marketing, social sharing | `ux` | proposed | 1-2 days |

---

## Phase 2: Table Stakes

*Features users expect from any modern note-taking app. Removes switching barriers.*

| # | Feature | Area | Status | Effort |
|---|---------|------|--------|--------|
| 2.1 | **Image Attachments** — Drag-and-drop images, screenshots, diagrams into notes. Supabase Storage, image compression, storage quota | `editor` | proposed | 2-3 weeks |
| 2.2 | **Virtual Scrolling** — Smooth performance for large note collections via windowed rendering | `ux` | proposed | 1-2 weeks |
| 2.3 | **Quick Capture** — Keyboard shortcut or widget for instant note creation from anywhere | `platform` | proposed | 1-2 weeks |

---

## Phase 3: Differentiation

*Unique features no competitor offers. This is the moat.*

### 3A: Editor Excellence

| # | Feature | Area | Status | Effort |
|---|---------|------|--------|--------|
| 3.1 | **Typewriter Mode** — Keep current line vertically centered, smooth scroll as you type | `editor` | proposed | 1 week |
| 3.2 | **Custom body font exploration** — Replace Inter with Literata or Source Serif 4 for warmer feel | `editor` | proposed | 1 week |
| 3.3 | **Writing session stats** — Subtle word/character count on hover, optional writing time | `editor` | proposed | 3 days |

### 3B: Quiet Intelligence (AI)

*"Help me remember what matters" — not generate more content.*

| # | Feature | Area | Status | Effort |
|---|---------|------|--------|--------|
| 3.4 | **Quiet Tasks** — Surface explicit checkboxes + implicit intentions ("I should...", "need to...") from notes. Server-side extraction via PostgreSQL regex | `ai` | planned | 3-4 weeks |
| 3.5 | **Daily Whisper** — Personalized quote/thought based on writing themes, shown on app open | `ai` | proposed | 2-3 weeks |
| 3.6 | **Weekly Digest Email** — Extracted to-dos, writing patterns, reflection prompts delivered to inbox | `ai` | proposed | 3-4 weeks |
| 3.7 | **Resonance Threads** — Connect related thoughts written months apart | `ai` | proposed | 4-6 weeks |
| 3.8 | **Seasonal Echo** — "This time last year..." reflections surfaced on anniversary dates | `ai` | proposed | 2-3 weeks |
| 3.9 | **Quiet Questions** — Reflection prompts drawn from your own writing | `ai` | proposed | 2-3 weeks |
| 3.10 | **The Convergence** — Notice when multiple themes in your life are aligning | `ai` | proposed | 4-6 weeks |
| 3.11 | **Gentle Grounding** — Awareness of emotional tone shifts across notes | `ai` | proposed | 4-6 weeks |
| 3.12 | **The Unsaid** — Notice themes that have quietly faded from your writing | `ai` | proposed | 4-6 weeks |

### 3C: Infrastructure for Intelligence

| # | Feature | Area | Status | Effort |
|---|---------|------|--------|--------|
| 3.13 | **Subscription system** — Bloom tier ($4/mo), LemonSqueezy integration, `subscriptions` table, `SubscriptionContext`, `FeatureGate` component | `infra` | planned | 2-3 weeks |

---

## Phase 4: Growth

*Features that bring in new users and expand the product's reach.*

| # | Feature | Area | Status | Effort |
|---|---------|------|--------|--------|
| 4.1 | **Public Garden** — Toggle notes as public to create a minimal blog at your own URL. No analytics, no comments. Growth loop: write → publish → share → discover → signup | `growth` | proposed | 2-3 weeks |
| 4.2 | **Live Shared Letters** — Shared links that stay in sync with the original note. Edits reflect automatically via realtime subscription on encrypted channel | `growth` | proposed | 3-4 weeks |
| 4.3 | **Additional OAuth** — Apple Sign-In and other providers | `platform` | proposed | 1 week |
| 4.4 | **App Store Distribution** — Native Android (Play Store, $25), iOS (App Store, $99/yr, requires macOS) via Capacitor | `platform` | proposed | 4-6 weeks |
| 4.5 | **Usage Analytics** — Privacy-respecting writing habit insights for users | `ai` | proposed | 2-3 weeks |

---

## Won't Do

Refused, with reasons, so they stop resurfacing. The **permanent** non-goals —
the ones refused on principle rather than on current fit — are owned by
`PRODUCT.md`; this table is the working list and repeats a few of them for
convenience.

A recovery key is planned; account recovery is not an omission.

| Feature | Why not |
|---------|---------|
| Databases | That's Notion's game |
| Graph view | That's Obsidian's game |
| Real-time collaboration | That's Notion/Craft's game. Single-user only is a design choice |
| Folders / hierarchy | Contradicts temporal chapters philosophy |
| Push notifications | Contradicts calm technology philosophy |
| Gamification | Contradicts wabi-sabi philosophy |
| Floating selection toolbar | Feels out of place with Yidhan's calm, static aesthetic — works for Notion/Medium but not for a quiet journal |

---

## Open GitHub issues

The issue tracker is authoritative for open work. Tracked here for orientation
only: #121, #122, #125, #129–#133, #138–#141, #143, #145, #146, #150.
