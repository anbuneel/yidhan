# Competitive Growth Plan for Zenote

**Version:** 1.1
**Last Updated:** 2026-01-07
**Status:** Living Document
**Author:** Claude (Opus 4.5)

---

## Original Prompt

> I need a new plan to make this app more competitive against the existing apps on the market.

**User Goals:**
- Primary: Grow user base (attract users from competitors)
- Direction: AI-powered reflection + Enhanced mobile/offline

---

## Executive Summary

Zenote's competitive strategy combines **table stakes features** (offline, images, mobile polish) to remove switching barriers with **unique differentiators** (Gentle AI Reflection, Daily Whisper) that no competitor offers. The goal is to own the niche of *"the note-taking app for people overwhelmed by note-taking apps."*

---

## Current Competitive Position

**Zenote's niche:** *"The note-taking app for people overwhelmed by note-taking apps."*

### Strengths
- Best-in-class visual identity (wabi-sabi aesthetic, 9/10 score)
- Unique temporal chapters (auto-organization)
- True cross-platform (reaches Windows/Linux/Android users Apple Notes and Bear can't)
- Distinctive philosophy ("Faded Notes", "Letting Go")

### Weaknesses vs Competitors
- ~~No offline editing~~ ✅ **RESOLVED in v2.0.0** (IndexedDB + sync queue + conflict resolution)
- No image attachments (expected feature)
- No linked notes/backlinking (Obsidian's killer feature)
- Web-only (no native mobile integrations)

---

## Phase 1: Foundation (Table Stakes)

*Remove barriers preventing users from switching*

| Feature | Why It Matters | Competitor Parity | Status |
|---------|----------------|-------------------|--------|
| **Offline editing** | Users can't use app on subway, flights | Apple Notes, Bear, Craft | ✅ **DONE** (v2.0.0) |
| **Image attachments** | Expected feature, blocks many users | All competitors | ❌ Not started |
| **Mobile polish** | Real device testing, PWA install flow | All competitors | ❓ Untested |

### Implementation Notes

**Offline Editing:** ✅ **COMPLETE**
- IndexedDB via Dexie.js
- Sync queue with compaction and dependency ordering
- "Two Paths" conflict resolution modal
- See `docs/archive/plans/offline-editing-full-implementation-plan.md`

**Image Attachments:**
- Supabase Storage for file hosting
- Drag-and-drop upload in editor
- Image optimization/compression
- Storage quota per user

**Mobile Polish:**
- Real device testing (iPhone SE, iPhone 15 Pro Max, Samsung Galaxy)
- Safe area handling for notch/home indicator
- Keyboard behavior validation
- PWA install prompt

---

## Phase 2: Differentiation (Moat)

*Features no competitor offers*

| Feature | Why It's Unique | Marketing Angle |
|---------|-----------------|-----------------|
| **Gentle AI Reflection** | Surfaces YOUR forgotten thoughts—not AI-generated content | *"Zenote remembers what you meant to do"* |
| **Daily Whisper** | Personalized quote/thought based on your writing themes | *"A quiet word to start your day"* |
| **Weekly Digest Email** | Extracted to-dos, patterns, reflection prompts | *"Your week in words"* |

### Gentle AI Reflection

**Philosophy:** Help users remember what matters—not generate more content.

**Competitor Comparison:**
| Competitor AI | Focus |
|---------------|-------|
| Notion AI | "Help me write more" (generation, summarization) |
| Craft AI | "Help me write better" (editing, expansion) |
| Obsidian + plugins | "Help me search/query" (RAG, Q&A) |
| **Zenote (proposed)** | **"Help me remember what matters"** (proactive, gentle surfacing) |

**Possible Features:**
- Daily digest email with extracted to-dos and reminders
- Gentle nudges about things you mentioned but may have forgotten
- Pattern recognition ("you've written about X frequently this month")
- Weekly reflection prompts based on your own words

**Why This Aligns with Zenote's Philosophy:**
- Non-intrusive (email digest, not push notifications)
- Reflective, not productive
- Surfaces YOUR words, not AI-generated content
- Calm, not urgent

### Daily Whisper

**Concept:** Show a personalized quote, thought, or gentle observation when users open the app—curated to their interests based on what they've been writing about.

**Why This Works:**
| Aspect | How It Aligns |
|--------|---------------|
| **Personality** | Note apps are cold/utilitarian. This makes Zenote feel alive. |
| **Curation** | Personalized to interests = feels like the app "knows" you |
| **Mood** | Starts the session with positivity, not a blank page stare |
| **Retention** | Gives users a reason to open the app even when not writing |

**Where It Could Appear:**
- Subtle banner when opening library
- Part of the daily email digest
- In the empty state (before any notes)
- As a loading state moment

**Example:**
> *"Because you've been writing about focus lately..."* followed by a relevant quote from philosophy or literature.

---

## Phase 3: Growth Loops

*Features that bring in new users*

| Feature | Growth Mechanism |
|---------|-----------------|
| **Public Garden** | Users publish notes → share links → organic discovery |
| **Share as Letter** (exists) | Note sharing already in place—promote it more |
| **Cross-platform marketing** | Target Windows/Linux/Android users ignored by Apple Notes/Bear |

### Public Garden

**Concept:** Toggle notes as public to create a minimal blog at your own URL. No analytics, no comments—just your words, quietly visible.

**Growth Loop:**
1. User writes a note they're proud of
2. User publishes to their Public Garden
3. User shares link on social media / with friends
4. Reader discovers Zenote through the note
5. Reader signs up to create their own garden

### Cross-Platform Marketing Message

> *"Your notes shouldn't be locked to one ecosystem. Zenote works on any device—Mac, Windows, Linux, iOS, Android, ChromeOS. No app to install. Just open and write."*

**Target Audience:**
- Windows users frustrated by lack of good note apps
- Linux users with no native options
- Android users who can't use Apple Notes or Bear
- People who switch between ecosystems

---

## Recommended Priority Order

1. ~~**Offline editing**~~ — ✅ **DONE** (v2.0.0)
2. **Image attachments** — P1, most-requested missing feature
3. **Gentle AI Reflection** — The differentiator (start with weekly email digest)
4. **Daily Whisper** — Low effort, high delight
5. **Public Garden** — Growth loop for organic discovery

---

## Monetization Angle

**Gentle AI Reflection** could be the paid tier feature that doesn't gate core note-taking functionality:

| Tier | Features |
|------|----------|
| **Free** | Unlimited notes, tags, export, sharing |
| **Zen+** | AI reflection, weekly digest, Daily Whisper, priority support |

This keeps the core product free (important for growth) while offering genuine value for power users.

---

## Success Metrics

### Phase 1 (Foundation)
- Offline: ✅ Users can create/edit notes without internet
- Images: >50% of active users attach at least one image
- Mobile: <5% mobile-specific bug reports

### Phase 2 (Differentiation)
- AI Digest: >30% email open rate
- Daily Whisper: >20% of sessions show engagement (click, dismiss, etc.)
- Retention: 7-day retention increases by 10%

### Phase 3 (Growth)
- Public Garden: >10% of users publish at least one note
- Organic signups from shared notes: >5% of new users
- Cross-platform: Windows/Linux/Android users >30% of base

---

## Related Documents

- [Competitive Design Evaluation](competitive-design-evaluation-claude.md) — Detailed competitor analysis
- [Launch Readiness Assessment](launch-readiness-assessment.md) — Current blockers and status
- [Offline Implementation Plan](offline-editing-full-implementation-plan.md) — ✅ Complete
- [Mobile Strategy Analysis](mobile-strategy-analysis-claude.md) — Mobile roadmap
