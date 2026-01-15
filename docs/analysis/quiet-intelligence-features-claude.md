# Quiet Intelligence: AI Feature Analysis for Yidhan

**Version:** 1.3
**Last Updated:** 2026-01-14
**Status:** Living Document (with finalized extensible architecture)
**Author:** Claude (Opus 4.5)

---

## Original Prompt

> What unique features can we add to Yidhan to differentiate it from other competitors? I was thinking of layering in "quiet intelligence" that uses Gen AI in the background to help users. What use cases / scenarios could we address?

---

## Executive Summary

This document proposes a comprehensive "Quiet Intelligence" feature layer for Yidhan — AI capabilities that run silently in the background to help users **remember what matters**, not generate more content. This positioning is unique in the note-taking landscape and aligns perfectly with Yidhan's wabi-sabi philosophy.

**Core differentiator:** While other apps use AI to help you write more, Yidhan uses AI to help you **reflect on what you've already written**.

---

## Strategic Context

### Existing Discussion

The `competitive-growth-plan-claude.md` established the foundation:
- **Positioning:** "Help me remember what matters" — not generate more content
- **Initial ideas:** Daily Whisper, Weekly Digest Email, pattern recognition
- **Philosophy:** Non-intrusive, reflective, surfaces YOUR words

### Competitive AI Landscape

| Competitor | AI Focus | User Need |
|------------|----------|-----------|
| Notion AI | "Help me write more" | Generation, summarization |
| Craft AI | "Help me write better" | Editing, expansion |
| Obsidian + plugins | "Help me search/query" | RAG, Q&A |
| Mem | "Help me organize" | Auto-tagging, search |
| **Yidhan (proposed)** | **"Help me remember"** | Proactive, gentle surfacing |

**The whitespace:** Nobody owns "reflective AI" — AI that helps you process what you've already written rather than produce more.

---

## Design Philosophy

All Quiet Intelligence features must follow these principles:

| Principle | Description |
|-----------|-------------|
| **Background operation** | No manual triggers required; AI works silently |
| **Gentle surfacing** | Never intrusive; always optional to view |
| **Your words** | Uses quotes and phrases from user's own notes |
| **Respects silence** | If nothing meaningful to say, says nothing |
| **Wabi-sabi alignment** | Embraces impermanence, absence, natural rhythms |
| **Dismissable** | User can always decline, hide, or disable |

**Brand language options:**
- "Gentle Memory" — The app remembers what you meant to do
- "Quiet Companion" — A presence that notices without interrupting
- "Whispers" — Soft observations from your own writing

---

## Complete Feature Catalog

### Summary Table (All 12 Features)

| # | Feature | Category | Source | Effort | Impact | Tier |
|---|---------|----------|--------|--------|--------|------|
| 1 | Daily Whisper | Engagement | Existing | Low | High | Free |
| 2 | Weekly Digest Email | Engagement | Existing | Low | High | Free |
| 3 | Resonance Threads | Connection | New | Medium | Very High | Bloom |
| 4 | The Quiet Reminder | Intention | New | Medium | High | Bloom |
| 5 | Seasonal Echo | Reflection | New | Medium | High | Bloom |
| 6 | The Fading Whisper | Declutter | New | Low | Medium | Free |
| 7 | The Unsaid | Awareness | New | High | Medium | Bloom |
| 8 | Quiet Questions | Reflection | New | Medium | High | Bloom |
| 9 | The Convergence | Insight | New | Medium | Very High | Bloom |
| 10 | Gentle Grounding | Emotional | New | High | Medium | Bloom |
| 11 | Letter to Future Self | Time Capsule | New | Low | Medium | Free |
| 12 | Whispered Summary | Re-engagement | New | Medium | High | Bloom |

---

## Feature Details

### 1. Daily Whisper (Existing Concept)

**Category:** Engagement / Delight

**Scenario:** User opens Yidhan in the morning. Instead of a blank library, they see a gentle greeting.

**Experience:**
> *"Because you've been writing about focus lately..."*
>
> *"The ability to simplify means to eliminate the unnecessary so that the necessary may speak." — Hans Hofmann*

**Why It Works:**
- Makes the app feel alive, not utilitarian
- Personalized to user's actual interests
- Starts the session with positivity
- Gives users a reason to open the app even when not writing

**Implementation:**
- Analyze recent note themes via topic modeling
- Match to curated quote database by category
- Show as subtle banner on library view
- Dismissable, non-blocking

**Effort:** Low | **Impact:** High | **Tier:** Free (retention driver)

---

### 2. Weekly Digest Email (Existing Concept)

**Category:** Engagement / Retention

**Scenario:** User receives a weekly email summarizing their writing activity and surfacing insights.

**Experience:**
> **Subject:** Your week in words — January 8-14
>
> *You wrote 4 notes this week, mostly about the new project launch.*
>
> **Things you mentioned wanting to do:**
> - "Follow up with the design team"
> - "Research competitor pricing"
>
> **A thread through your notes:**
> *You've mentioned "deadline pressure" in 3 notes. Take a breath.*
>
> **This time last year:**
> *You were planning your garden. "I want to try growing tomatoes this year."*

**Why It Works:**
- Non-intrusive (email, not push notification)
- Extracts actionable items without forcing to-do methodology
- Surfaces patterns user might not notice
- Keeps users engaged even when not in-app

**Implementation:**
- Weekly batch job analyzing recent notes
- Intent extraction for "want to" / "should" / "need to" phrases
- Topic clustering for pattern detection
- Optional — user can enable/disable

**Effort:** Low | **Impact:** High | **Tier:** Free (acquisition driver)

---

### 3. Resonance Threads (Connecting the Dots)

**Category:** Connection / Discovery

**Scenario:** User writes about "anxiety about the presentation" in January, then writes about "nervous about the talk" in March. They never searched for it or tagged it.

**Experience:**
> *"A thread runs through your notes..."*
>
> *You've reflected on presentations 4 times since January. Here's what you said:*
>
> - Jan 15: "The presentation is next week and I can't stop thinking about it"
> - Feb 2: "Survived the demo. It actually went better than expected"
> - Mar 10: "Another talk coming up. Why does this still make me nervous?"

**Why It's Unique:**
- Not search (user didn't ask)
- Not tagging (user didn't organize)
- **Proactive connection** of thoughts across time
- Like a thoughtful friend who remembers what you've said

**Implementation:**
- Semantic embedding of all notes
- Clustering by topic/theme over time
- Surface when cluster reaches significance threshold
- Show in dedicated "Threads" section or on relevant note view

**Effort:** Medium | **Impact:** Very High | **Tier:** Bloom

---

### 4. The Quiet Reminder (Unfinished Intentions)

**Category:** Intention / Follow-through

**Scenario:** User wrote "I should really call Dad more often" 3 weeks ago. It wasn't a task list. Just a passing thought.

**Experience:**
> *"Three weeks ago, you wrote:"*
>
> *"I should really call Dad more often. We haven't talked since Christmas."*
>
> *Does that still feel important?*
>
> [Yes, remind me] [Let it fade]

**Why It's Unique:**
- **No to-do list required** — extracts intentions from natural writing
- Non-judgmental ("does that still feel important?" vs "you haven't done this")
- Respects that some intentions naturally fade
- Surfaces the implicit, not just the explicit

**Implementation:**
- NER + intent classification for "I should," "I want to," "need to," "remind me to"
- Time-delayed surfacing (1-4 weeks after writing)
- User can snooze, dismiss, or mark complete
- Never nags — one gentle prompt per intention

**Effort:** Medium | **Impact:** High | **Tier:** Bloom

---

### 5. Seasonal Echo (This Time Last Year)

**Category:** Reflection / Memory

**Scenario:** User has been using Yidhan for over a year. It's March 15th. A year ago, they wrote about starting their garden.

**Experience:**
> *"A year ago today, you wrote:"*
>
> *"Finally bought the tomato seedlings. I've never grown anything before but something about this spring feels right for trying."*
>
> [View full note]

**Why It's Unique:**
- Like "On This Day" but for **your own reflections**, not photos
- Surfaces moments of significance YOU captured
- Encourages **long-term relationship** with the app
- Deeply personal and often emotional

**Implementation:**
- Date-based retrieval (±3 days for flexibility)
- Semantic filtering to surface significant entries (not "bought groceries")
- Significance score based on length, emotional content, uniqueness
- Show on app open or in weekly digest

**Effort:** Medium | **Impact:** High | **Tier:** Bloom

---

### 6. The Fading Whisper (Notes Ready to Let Go)

**Category:** Declutter / Mindfulness

**Scenario:** A note titled "Conference planning 2024" hasn't been touched in 8 months. It's just sitting in the archive, cluttering space.

**Experience:**
> *"This note from last June hasn't been opened since."*
>
> *"Conference planning 2024 — session ideas, speaker contacts..."*
>
> *Does it still serve you, or is it ready to fade?*
>
> [Keep it] [Let it fade]

**Why It's Unique:**
- Aligns perfectly with **"Letting Go" philosophy**
- Proactive decluttering that **respects the user**
- Not "storage limit reached" — it's about **mindfulness**
- Helps notes naturally "compost" over time
- Connects to existing Faded Notes feature

**Implementation:**
- Access pattern analysis (last opened, last edited)
- Staleness threshold (e.g., 6+ months untouched)
- Periodic gentle prompts (monthly review)
- "Let it fade" moves to Faded Notes with accelerated expiry

**Effort:** Low | **Impact:** Medium | **Tier:** Free (philosophy alignment)

---

### 7. The Unsaid (Noticing What's Missing)

**Category:** Awareness / Pattern Detection

**Scenario:** User used to write about "morning runs" frequently — 3-4 times a month for 6 months. They haven't mentioned it in 2+ months.

**Experience:**
> *"A rhythm seems to have paused..."*
>
> *You used to write about your morning runs — 12 times between April and September. You haven't mentioned them since.*
>
> *Life changes. Just noticing.*

**Why It's Unique:**
- Most AI focuses on **what's there**; this notices **what's absent**
- Surfaces life changes without judgment
- Could prompt reflection ("did I stop on purpose?") or awareness of drift
- Very **wabi-sabi** — noticing absence, impermanence, change
- No other app does this

**Implementation:**
- Topic frequency analysis over rolling time windows
- Detect statistically significant drops in recurring themes
- Minimum frequency threshold (must have been mentioned 5+ times)
- Gentle, non-judgmental language always

**Effort:** High | **Impact:** Medium | **Tier:** Bloom

---

### 8. Quiet Questions (Reflection Prompts from Your Words)

**Category:** Reflection / Journaling

**Scenario:** User has been writing about "work-life balance" in various forms across several notes without explicitly calling it that.

**Experience:**
> *"A question from your notes..."*
>
> *You've written about "finding balance" several times lately — between work and rest, ambition and peace.*
>
> *What does balance look like for you right now?*
>
> [Write about this] [Not now]

**Why It's Unique:**
- **NOT generic prompts** ("What are you grateful for?")
- Personalized to YOUR themes and YOUR language
- Encourages deeper reflection on topics you're already processing
- Could appear daily, weekly, or on demand
- Turns the app into a reflective writing partner

**Implementation:**
- Topic clustering across recent notes
- Question generation using user's own vocabulary
- Curated question templates by theme category
- Optional — can enable "reflection mode" in settings

**Effort:** Medium | **Impact:** High | **Tier:** Bloom

---

### 9. The Convergence (When Multiple Themes Align)

**Category:** Insight / Synthesis

**Scenario:** User has written separately about "thinking about a career change," "maybe moving to a new city," and "feeling uncertain about the future." Three different notes, not explicitly connected.

**Experience:**
> *"A convergence in your notes..."*
>
> *Several recent notes touch on transitions:*
> - Career: "Maybe it's time for something new"
> - Place: "I keep looking at apartments in Portland"
> - Feeling: "Everything feels uncertain right now"
>
> *A season of change?*

**Why It's Unique:**
- **Synthesizes across notes** without user effort
- Helps user see patterns they might not notice
- Not search, not summary — it's **insight**
- Like a therapist noticing themes in what you're saying
- Creates "aha" moments

**Implementation:**
- Multi-topic co-occurrence analysis
- Identify semantic clusters forming across recent notes (2-4 week window)
- Minimum 3 notes touching related themes
- Human-readable synthesis with quotes

**Effort:** Medium | **Impact:** Very High | **Tier:** Bloom

---

### 10. Gentle Grounding (Emotional Tone Awareness)

**Category:** Emotional / Wellness

**Scenario:** The AI notices a shift in tone across recent notes — more anxious language, shorter notes, more mentions of stress, fewer reflections.

**Experience:**
> *"A gentle observation..."*
>
> *Your recent notes feel a bit heavier than usual. More urgency, less space.*
>
> *Would you like a moment to breathe?*
>
> [Take a breath] [I'm okay]

If they choose "Take a breath" → Simple 60-second breathing exercise or nature soundscape.

**Why It's Unique:**
- **Emotional intelligence**, not productivity optimization
- Non-diagnostic ("feel heavier" not "you seem depressed")
- Checks in without being intrusive
- Could be the only app that **notices how you're doing**
- Respects user agency — never prescriptive

**Implementation:**
- Sentiment analysis across recent notes
- Linguistic marker detection (negative emotion words, urgency, shortened length)
- Comparison to user's baseline over time
- Very careful, gentle language — never clinical

**Effort:** High | **Impact:** Medium | **Tier:** Bloom

---

### 11. Letter to Future Self (Time Capsules)

**Category:** Time Capsule / Delight

**Scenario:** User writes a note and chooses to "send it to future me" — 1 month, 6 months, or 1 year from now. They forget about it.

**Experience (6 months later):**
> *"A letter from past you..."*
>
> *Six months ago, on a summer evening, you wrote this and asked to receive it today:*
>
> *"I hope you figured out the job situation. I hope you're less stressed. I hope you remember that you were trying really hard right now and it's okay if things aren't perfect yet."*
>
> [Read full note] [Write a response]

**Why It's Unique:**
- Creates **intentional time capsules**
- User-initiated but AI-delivered
- Builds anticipation and long-term engagement
- Deeply personal and often emotional
- "Write a response" creates a dialogue with past self

**Implementation:**
- "Send to future me" button in editor
- Delivery date picker (1 month, 3 months, 6 months, 1 year, custom)
- Scheduled delivery system
- Email notification + in-app display

**Effort:** Low | **Impact:** Medium | **Tier:** Free (delight/retention)

---

### 12. Whispered Summary (Welcome Back After Absence)

**Category:** Re-engagement / Onboarding

**Scenario:** User hasn't opened Yidhan in 2 weeks. Life got busy. They return and feel disoriented — "where was I?"

**Experience:**
> *"While you were away, your notes rested."*
>
> *Here's a whisper of where you left off:*
>
> *You were mostly writing about the **product launch** — 4 notes over your last week. The last thing you wrote: "Need to finalize the pricing page before Monday."*
>
> *Your most recent notes:*
> - Launch prep thoughts (Jan 2)
> - Meeting notes — design review (Jan 1)
> - New year intentions (Dec 31)
>
> [Continue where you left off]

**Why It's Unique:**
- Makes **return feel welcoming**, not overwhelming
- Acknowledges the gap without judgment ("rested" not "abandoned")
- Re-orients the user gently
- Reduces friction of "wait, where was I?"
- Increases likelihood of re-engagement after dormancy

**Implementation:**
- Inactivity detection (7+ days since last session)
- Summarization of last active period
- Context-aware display on return (not shown if recent user)
- Graceful fallback if no recent activity to summarize

**Effort:** Medium | **Impact:** High | **Tier:** Bloom

---

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-4)

**Goal:** Ship 2-3 features that validate the "Quiet Intelligence" concept with users.

| Feature | Rationale | Dependency |
|---------|-----------|------------|
| Daily Whisper | Low effort, high delight, validates personalization | Quote database |
| Weekly Digest Email | Acquisition driver, tests intent extraction | Email infrastructure |
| Letter to Future Self | Simple UX, high emotional impact | Scheduling system |

**Success metrics:**
- Daily Whisper: >20% engagement (click/dismiss vs ignore)
- Email digest: >30% open rate, >10% click-through
- Time capsules: >5% of users create at least one

### Phase 2: Core Intelligence (Weeks 5-10)

**Goal:** Ship the differentiating features that no competitor has.

| Feature | Rationale | Dependency |
|---------|-----------|------------|
| Resonance Threads | Highest impact differentiator | Semantic embeddings |
| Seasonal Echo | High emotional resonance | 1+ year of user data |
| The Quiet Reminder | Surfaces intentions uniquely | Intent classification |
| The Fading Whisper | Aligns with existing philosophy | Access pattern tracking |

**Success metrics:**
- Resonance Threads: Users report "aha moments" in feedback
- Seasonal Echo: High engagement on anniversary content
- Quiet Reminder: >15% of surfaced intentions acted upon
- Fading Whisper: >50% of prompted notes released or kept (engagement)

### Phase 3: Deep Intelligence (Weeks 11-16)

**Goal:** Build the more complex features that require sophisticated NLP.

| Feature | Rationale | Dependency |
|---------|-----------|------------|
| The Convergence | Multi-note synthesis | Topic clustering |
| Quiet Questions | Personalized prompts | Theme extraction |
| Whispered Summary | Re-engagement optimization | Summarization model |

### Phase 4: Emotional Intelligence (Weeks 17+)

**Goal:** Carefully introduce emotionally-aware features with appropriate safeguards.

| Feature | Rationale | Dependency |
|---------|-----------|------------|
| The Unsaid | Notices absence patterns | Long-term user data |
| Gentle Grounding | Emotional tone awareness | Sentiment baseline |

**Caution:** These features require careful language design and should be extensively user-tested to avoid feeling invasive or clinical.

---

## Technical Architecture

### AI Infrastructure Requirements

```
┌─────────────────────────────────────────────────────────────┐
│                    Quiet Intelligence Layer                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐   │
│  │   Embedding   │  │    Topic      │  │   Sentiment   │   │
│  │    Service    │  │   Clustering  │  │   Analysis    │   │
│  └───────────────┘  └───────────────┘  └───────────────┘   │
│          │                  │                  │            │
│          └──────────────────┼──────────────────┘            │
│                             │                               │
│                    ┌────────▼────────┐                      │
│                    │  Note Analysis  │                      │
│                    │     Engine      │                      │
│                    └────────┬────────┘                      │
│                             │                               │
│          ┌──────────────────┼──────────────────┐            │
│          │                  │                  │            │
│  ┌───────▼───────┐  ┌───────▼───────┐  ┌───────▼───────┐   │
│  │   Threads     │  │   Insights    │  │   Prompts     │   │
│  │   Service     │  │   Generator   │  │   Queue       │   │
│  └───────────────┘  └───────────────┘  └───────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Delivery Layer │
                    │  (App / Email)  │
                    └─────────────────┘
```

### Key Technical Decisions

| Decision | Options | Recommendation |
|----------|---------|----------------|
| Embedding model | OpenAI, Cohere, local | OpenAI text-embedding-3-small (cost-effective) |
| Processing | Real-time vs batch | Batch (nightly job) for most features |
| Storage | Embeddings in Supabase | pgvector extension for similarity search |
| Email | SendGrid, Resend, Postmark | Resend (developer-friendly, good deliverability) |
| LLM for synthesis | GPT-4, Claude, Gemini | Claude (aligns with calm, thoughtful tone) |

### Privacy Considerations

| Concern | Mitigation |
|---------|------------|
| Note content sent to AI | Process embeddings locally where possible; clear data retention policy |
| Emotional analysis | Strictly opt-in; no data shared externally; user can view/delete analysis |
| Pattern detection | All insights derived from user's own notes; no cross-user analysis |
| Email digests | User controls frequency; one-click unsubscribe; no tracking pixels |

---

## Monetization Strategy

### Free Tier (Acquisition & Retention)

Features that drive adoption and daily engagement:

- Daily Whisper
- Weekly Digest Email (basic)
- Letter to Future Self
- The Fading Whisper

### Bloom Tier (Premium Value)

Features that provide deeper intelligence:

- Resonance Threads
- The Quiet Reminder
- Seasonal Echo
- Quiet Questions
- The Convergence
- Gentle Grounding
- Whispered Summary
- The Unsaid
- Enhanced Weekly Digest (with full insights)

### Pricing Alignment

From `monetization-philosophy.md`:
> *"Zenote is free. If it brings you calm, consider supporting its quiet existence for $4/month."*

Quiet Intelligence features fit naturally into this model — they provide genuine value for users who want deeper reflection without gating core note-taking functionality.

---

## Success Metrics

### Engagement Metrics

| Metric | Target | Feature |
|--------|--------|---------|
| Daily Whisper engagement | >20% | Daily Whisper |
| Email open rate | >30% | Weekly Digest |
| Email click-through | >10% | Weekly Digest |
| Time capsule creation | >5% of users | Letter to Future Self |
| Thread discovery rate | Track | Resonance Threads |
| Intention follow-through | >15% | Quiet Reminder |

### Retention Metrics

| Metric | Target | Rationale |
|--------|--------|-----------|
| 7-day retention | +10% | AI features should increase return visits |
| 30-day retention | +15% | Deeper features create long-term engagement |
| Reactivation rate | +20% | Whispered Summary should recover dormant users |

### Qualitative Metrics

| Signal | Method |
|--------|--------|
| "Aha moment" reports | User feedback, support tickets |
| Feature satisfaction | In-app rating after feature use |
| Brand perception | "Yidhan feels like it knows me" sentiment |

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Feels creepy/invasive** | High | Extremely careful language; always opt-in; user controls visibility |
| **Over-notification** | Medium | Strict limits on surfacing frequency; "quiet" is the brand |
| **Privacy concerns** | High | Clear data policy; no cross-user analysis; local processing where possible |
| **AI hallucination** | Medium | Always quote user's actual words; never fabricate |
| **Feature bloat** | Medium | Each feature must pass "does this preserve the quiet?" test |
| **Cost overrun** | Medium | Start with batch processing; use efficient models; monitor usage |

---

## Competitive Differentiation Summary

| Capability | Notion | Craft | Obsidian | Mem | **Yidhan** |
|------------|--------|-------|----------|-----|------------|
| Generate content | ✅ | ✅ | ❌ | ❌ | ❌ |
| Edit/improve text | ✅ | ✅ | ❌ | ❌ | ❌ |
| Search knowledge | ✅ | ❌ | ✅ | ✅ | ❌ |
| Auto-organize | ❌ | ❌ | ❌ | ✅ | ✅ (temporal) |
| **Surface forgotten thoughts** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Connect themes proactively** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Notice what's missing** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Emotional awareness** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Time-based reflection** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Intention extraction** | ❌ | ❌ | ❌ | ❌ | ✅ |

**Yidhan's unique position:** The only note app with **reflective AI** — intelligence that helps you understand what you've written rather than produce more.

---

## Appendix: Feature Quick Reference

| # | Feature | One-Line Description |
|---|---------|---------------------|
| 1 | Daily Whisper | Personalized quote/thought when opening app |
| 2 | Weekly Digest Email | Summary of writing + surfaced intentions + patterns |
| 3 | Resonance Threads | Proactively connects related thoughts across time |
| 4 | The Quiet Reminder | Surfaces intentions you wrote but may have forgotten |
| 5 | Seasonal Echo | "This time last year, you wrote..." |
| 6 | The Fading Whisper | Suggests notes ready to let go |
| 7 | The Unsaid | Notices themes you've stopped writing about |
| 8 | Quiet Questions | Reflection prompts using your own language |
| 9 | The Convergence | Synthesizes when multiple themes align |
| 10 | Gentle Grounding | Notices shifts in emotional tone |
| 11 | Letter to Future Self | Time capsule delivery to future you |
| 12 | Whispered Summary | Welcome back summary after absence |

---

## Appendix A: The Quiet Reminder — Deep Dive

This appendix provides detailed implementation analysis for the Quiet Reminder feature, which extracts **implicit intentions** from natural writing.

### A.1 Core Concept

**Traditional to-do apps:** User explicitly creates a task → app nags until done

**Quiet Reminder:** User writes naturally → AI detects implicit intentions → gently surfaces them later → user decides if still relevant

The key insight: **People write about things they want to do without making to-do lists.**

### A.2 What Qualifies as an "Intention"?

Not every sentence is an intention. The AI looks for specific linguistic patterns:

| Pattern | Example | Confidence |
|---------|---------|------------|
| "I should..." | "I should call Mom this weekend" | High |
| "I need to..." | "I need to finish that report" | High |
| "I want to..." | "I want to start journaling more" | Medium |
| "I have to..." | "I have to remember to cancel that subscription" | High |
| "Remind me to..." | "Remind me to buy flowers for the anniversary" | Very High |
| "Don't forget..." | "Don't forget to email the contractor" | Very High |
| "Maybe I'll..." | "Maybe I'll try that new restaurant" | Low |
| "I've been meaning to..." | "I've been meaning to organize the garage" | High |

**What it ignores:**
- Past tense: "I should have called Mom" (already happened/regret)
- Hypotheticals: "If I had time, I should..." (not a real intention)
- Negatives: "I shouldn't eat so much sugar" (not actionable in the same way)

### A.3 Extraction Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    User writes a note                        │
│                                                              │
│  "Had coffee with Sarah today. She mentioned her new job     │
│   at the startup. I should reach out to her brother about    │
│   that freelance project he mentioned. Also need to renew    │
│   my passport before the trip in April."                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Intent Extraction (Background)              │
│                                                              │
│  Detected intentions:                                        │
│  1. "reach out to her brother about freelance project"       │
│     - Trigger: "I should"                                    │
│     - Confidence: High                                       │
│     - Context: Sarah's brother, freelance project            │
│                                                              │
│  2. "renew my passport before the trip in April"             │
│     - Trigger: "need to"                                     │
│     - Confidence: High                                       │
│     - Has deadline hint: "before April"                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Stored in Intentions Queue                │
│                                                              │
│  { intention: "reach out to Sarah's brother...",             │
│    source_note_id: "abc123",                                 │
│    extracted_at: "2026-01-13",                               │
│    surface_after: "2026-01-27",  // 2 weeks later            │
│    deadline_hint: null,                                      │
│    status: "pending" }                                       │
│                                                              │
│  { intention: "renew passport before April trip",            │
│    source_note_id: "abc123",                                 │
│    extracted_at: "2026-01-13",                               │
│    surface_after: "2026-02-15",  // Earlier due to deadline  │
│    deadline_hint: "April",                                   │
│    status: "pending" }                                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### A.4 When Does It Surface?

**Timing rules:**

| Scenario | Surface After |
|----------|---------------|
| No deadline hint | 2-3 weeks after writing |
| Has deadline hint | ~50% of time until deadline |
| "Remind me to..." (explicit) | 1 week after writing |
| User hasn't opened app in 7+ days | Include in "welcome back" |

**Where it appears:**

1. **In-app (subtle banner)** — When user opens the library
2. **Weekly digest email** — "Things you mentioned wanting to do"
3. **Dedicated "Quiet Tasks" view** — Optional screen showing all pending

### A.5 The UX Interaction

When surfaced, it looks like this:

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│  ╭─────────────────────────────────────────────────────────╮ │
│  │                                                         │ │
│  │  "Two weeks ago, you wrote:"                            │ │
│  │                                                         │ │
│  │  "I should reach out to Sarah's brother about           │ │
│  │   that freelance project he mentioned."                 │ │
│  │                                                         │ │
│  │  Does that still feel important?                        │ │
│  │                                                         │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────┐    │ │
│  │  │   Done ✓     │  │  Remind me   │  │  Let fade  │    │ │
│  │  │              │  │   later      │  │            │    │ │
│  │  └──────────────┘  └──────────────┘  └────────────┘    │ │
│  │                                                         │ │
│  │  [View original note]                                   │ │
│  │                                                         │ │
│  ╰─────────────────────────────────────────────────────────╯ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**The three responses:**

| Response | What Happens |
|----------|--------------|
| **Done ✓** | Marked complete. Never shown again. Optional: "Would you like to write about how it went?" |
| **Remind me later** | Snoozed for 1 week. Surfaces again once. |
| **Let it fade** | Dismissed permanently. No judgment. Some intentions naturally pass. |

### A.6 What Makes This Different from To-Do Apps?

| Aspect | Traditional To-Do | Quiet Reminder |
|--------|-------------------|----------------|
| **Creation** | User explicitly adds task | AI extracts from natural writing |
| **Tone** | "You have 5 overdue tasks!" | "Does this still feel important?" |
| **Persistence** | Nags until done | Surfaces once, then fades if ignored |
| **Failure** | Guilt when incomplete | "Let it fade" is a valid outcome |
| **Philosophy** | Productivity optimization | Mindful awareness |

### A.7 Technical Implementation

```typescript
// Types
interface Intention {
  id: string;
  userId: string;
  sourceNoteId: string;
  text: string;                    // The extracted intention
  originalSentence: string;        // Full sentence for context
  triggerPhrase: string;           // "I should", "need to", etc.
  confidence: 'low' | 'medium' | 'high' | 'very_high';
  deadlineHint: string | null;     // "April", "next week", etc.
  extractedAt: Date;
  surfaceAfter: Date;
  status: 'pending' | 'surfaced' | 'done' | 'snoozed' | 'faded';
  snoozedUntil: Date | null;
}

// Extraction patterns (simplified)
const INTENTION_PATTERNS = [
  { regex: /I should\s+(.+?)(?:\.|$)/gi, confidence: 'high' },
  { regex: /I need to\s+(.+?)(?:\.|$)/gi, confidence: 'high' },
  { regex: /I have to\s+(.+?)(?:\.|$)/gi, confidence: 'high' },
  { regex: /remind me to\s+(.+?)(?:\.|$)/gi, confidence: 'very_high' },
  { regex: /don'?t forget to\s+(.+?)(?:\.|$)/gi, confidence: 'very_high' },
  { regex: /I want to\s+(.+?)(?:\.|$)/gi, confidence: 'medium' },
  { regex: /I'?ve been meaning to\s+(.+?)(?:\.|$)/gi, confidence: 'high' },
];

// Could run client-side or as a background job
function extractIntentions(noteContent: string, noteId: string): Intention[] {
  const plainText = htmlToPlainText(noteContent);
  const intentions: Intention[] = [];

  for (const pattern of INTENTION_PATTERNS) {
    const matches = plainText.matchAll(pattern.regex);
    for (const match of matches) {
      intentions.push({
        id: generateId(),
        sourceNoteId: noteId,
        text: match[1].trim(),
        originalSentence: match[0],
        triggerPhrase: match[0].split(/\s+/).slice(0, 3).join(' '),
        confidence: pattern.confidence,
        deadlineHint: extractDeadlineHint(match[1]),
        extractedAt: new Date(),
        surfaceAfter: calculateSurfaceDate(pattern.confidence, match[1]),
        status: 'pending',
        // ...
      });
    }
  }

  return intentions;
}
```

### A.8 Edge Cases & Mitigations

| Concern | Mitigation |
|---------|------------|
| **Feels surveillance-y** | Clear opt-in. User can see all extracted intentions. Delete button. |
| **Too many intentions** | Limit to 3 surfaced per week. Prioritize by confidence & recency. |
| **Extracts wrong things** | "This doesn't look right" feedback button. Learns from corrections. |
| **Sensitive content** | Never surface intentions about health, relationships, finances in email. In-app only. |
| **User already did it** | "Already done? Tap here to mark complete without the reminder." |

---

## Appendix B: Quiet Tasks — Unified Task System

This appendix expands the Quiet Reminder concept into a complete task awareness system that handles **both explicit tasks and implicit intentions**.

### B.1 The Problem

Users create to-do lists and reminders in their notes but don't add dates/deadlines — and then forget about them. The tasks get buried across multiple notes.

### B.2 Two Types of "Things to Remember"

| Type | Example | Detection | Current Problem |
|------|---------|-----------|-----------------|
| **Implicit Intentions** | "I should call Mom" | AI extracts from prose | Never tracked at all |
| **Explicit Tasks** | "- [ ] Call the dentist" | User wrote a checkbox/list | Written but buried and forgotten |

Yidhan already has task lists via Tiptap checkboxes. The problem isn't *writing* tasks — it's **losing track of them** across multiple notes.

### B.3 What Gets Detected

```
┌─────────────────────────────────────────────────────────────┐
│                     EXPLICIT TASKS                          │
│                  (User deliberately wrote)                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ☑️ Tiptap Checkboxes (already in Yidhan)                   │
│     - [ ] Call the dentist                                  │
│     - [ ] Finish quarterly report                           │
│     - [x] Buy groceries  ← Already done, ignored            │
│                                                             │
│  📝 Task-like patterns in text                              │
│     • TODO: Review the contract                             │
│     • REMINDER: Cancel gym membership                       │
│     • Action item: Send proposal to client                  │
│                                                             │
│  🔢 Numbered lists that look like tasks                     │
│     1. Email the team about the delay                       │
│     2. Update the spreadsheet                               │
│     3. Schedule follow-up meeting                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    IMPLICIT INTENTIONS                      │
│                 (AI extracts from prose)                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  💭 Natural language intentions                             │
│     "I should reach out to Sarah's brother..."              │
│     "Need to renew my passport before April..."             │
│     "Remind me to water the plants while she's away..."     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### B.4 The "Quiet Tasks" View

A dedicated (but optional) view that shows everything in one place:

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back                    Quiet Tasks                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  🔍 Filter: All ▼    Sort: Oldest first ▼              ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│  RESTING LONGEST (might need attention)                     │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  ○ Call the dentist                              3 weeks    │
│    from "Health notes" · Jan 2                              │
│    [Done] [Snooze] [Let fade]                               │
│                                                             │
│  ○ Review the contract                           2 weeks    │
│    from "Work - Project X" · Jan 8                          │
│    [Done] [Snooze] [Let fade]                               │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│  RECENT                                                     │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  ○ Reach out to Sarah's brother about freelance  5 days    │
│    from "Coffee with Sarah" · Jan 13                        │
│    💭 Extracted from: "I should reach out to..."            │
│    [Done] [Snooze] [Let fade]                               │
│                                                             │
│  ○ Send proposal to client                       3 days     │
│    from "Meeting notes - Monday" · Jan 15                   │
│    [Done] [Snooze] [Let fade]                               │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│  COMPLETED RECENTLY                                         │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  ✓ Buy groceries                                 Done Jan 14│
│  ✓ Schedule team sync                            Done Jan 12│
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  💡 Tip: Tasks without deadlines surface by age.            │
│     The longer something rests, the higher it appears.      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### B.5 Smart Timing Without Deadlines

Since users often don't add dates — here's the smart timing logic:

| Signal | Surfacing Behavior |
|--------|-------------------|
| **Age** | Older uncompleted tasks bubble up ("resting longest") |
| **Note recency** | If you edited the note recently but didn't check the task, it's probably still relevant |
| **Note staleness** | If you haven't touched the note in 30+ days, maybe the whole context has passed |
| **Explicit deadline hint** | "before April", "next week" → surfaces earlier |
| **Task type** | Explicit checkboxes get priority over extracted intentions |

**The algorithm (simplified):**

```
Priority Score =
  (days_since_created × 1.5) +           // Older = more urgent
  (is_explicit_checkbox ? 10 : 0) +      // Checkboxes > prose
  (has_deadline_hint ? 20 : 0) +         // Deadline hints matter
  (note_recently_edited ? 5 : 0) -       // Recent note = still relevant
  (times_snoozed × 3)                    // Snoozed = less urgent
```

### B.6 Weekly Digest Integration

The weekly email becomes more powerful with Quiet Tasks:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Your week in words — January 13-20

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  📝 You wrote 6 notes this week, mostly about project planning.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ⏳ TASKS RESTING LONGEST

  These have been waiting a while. Still important?

  ○ Call the dentist (3 weeks)
    from "Health notes"

  ○ Review the contract (2 weeks)
    from "Work - Project X"

  ○ Cancel gym membership (2 weeks)
    from "Budget planning"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  💭 INTENTIONS YOU MENTIONED

  Things you wrote about wanting to do:

  ○ "I should reach out to Sarah's brother about that
     freelance project" (5 days ago)

  ○ "Need to renew my passport before April" (1 week ago)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ✓ COMPLETED THIS WEEK

  ✓ Buy groceries
  ✓ Schedule team sync
  ✓ Send meeting notes

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [View all tasks in Yidhan]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### B.7 Two-Way Sync with Notes

When you check off a task in the Quiet Tasks view, it should sync back to the original note:

```
┌─────────────────────────────────────────────────────────────┐
│                     TWO-WAY SYNC                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  In Note "Health notes":              Quiet Tasks View:     │
│  ┌─────────────────────┐              ┌─────────────────┐   │
│  │ - [ ] Call dentist  │  ◄────────►  │ ○ Call dentist  │   │
│  │ - [x] Buy vitamins  │              │ ✓ Buy vitamins  │   │
│  └─────────────────────┘              └─────────────────┘   │
│                                                             │
│  Check it off in either place → syncs to both               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**For extracted intentions** (no checkbox in original note):
- Marking "Done" in Quiet Tasks just marks it complete in the task system
- Optionally: "Would you like to add a note about this?" → appends to original note

### B.8 The "Let It Fade" Philosophy

This is NOT a productivity app. The philosophy:

| Traditional To-Do | Quiet Tasks |
|-------------------|-------------|
| "5 overdue tasks!" | "3 tasks resting longest" |
| Guilt for incomplete | "Let it fade" is valid |
| Must check off everything | Some things naturally pass |
| Red badges, notifications | Calm weekly summary |
| Tasks are obligations | Tasks are intentions |

**"Let it fade" scenarios:**
- You wrote "call the contractor" but you moved and it's irrelevant now
- You listed "research vacation destinations" but plans changed
- The context of the task no longer exists

> *"Not everything you write down needs to be done. Some thoughts are just passing through. Quiet Tasks helps you notice what's been resting — you decide what still matters."*

This reframes task management as **awareness** rather than **accountability**.

### B.9 Database Schema

```sql
-- Tasks/intentions extracted from notes
create table note_tasks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  source_note_id uuid references notes(id) on delete cascade not null,

  -- Task content
  text text not null,
  original_sentence text,  -- For intentions, the full sentence

  -- Classification
  type text not null check (type in ('explicit_checkbox', 'explicit_text', 'implicit_intention')),
  trigger_phrase text,  -- "I should", "TODO:", etc.
  confidence text check (confidence in ('low', 'medium', 'high', 'very_high')),

  -- Timing
  deadline_hint text,  -- "April", "next week", etc.
  created_at timestamptz default now() not null,
  surface_after timestamptz,

  -- Status
  status text not null default 'pending' check (status in ('pending', 'done', 'snoozed', 'faded')),
  snoozed_until timestamptz,
  completed_at timestamptz,

  -- Prevent duplicates
  unique(source_note_id, text)
);

-- RLS: Users can only see their own tasks
alter table note_tasks enable row level security;
create policy "Users can manage own tasks" on note_tasks
  for all using (auth.uid() = user_id);
```

### B.10 Implementation Phases

| Phase | What It Does | Complexity | Value |
|-------|--------------|------------|-------|
| **Phase 1: Task Aggregation** | Collect all Tiptap checkboxes across notes | Low | High |
| **Phase 2: Task-like Text** | Detect "TODO:", "REMINDER:", etc. | Low | Medium |
| **Phase 3: Intention Extraction** | Find "I should...", "need to..." | Medium | High |
| **Phase 4: Smart Surfacing** | Age-based priority without deadlines | Medium | High |
| **Phase 5: Two-way Sync** | Check off in view → updates note | Medium | Medium |
| **Phase 6: Weekly Digest** | Email summary of resting tasks | Low | High |

### B.11 UI Entry Points

Where does "Quiet Tasks" live in the app?

**Option A: Profile menu item (recommended)**
```
┌─────────────────────┐
│ 👤 Your Name        │
├─────────────────────┤
│ ⚙️ Settings         │
│ 📋 Quiet Tasks  (3) │  ← Badge shows pending count
│ 🌅 Faded Notes      │
│ 📤 Export           │
│ 🚪 Sign out         │
└─────────────────────┘
```

**Option B: Footer link (like Faded Notes)**
```
Changelog · Roadmap · Tasks · Shortcuts · GitHub
```

**Option C: Keyboard shortcut**
- `Cmd/Ctrl + T` → Open Quiet Tasks view

### B.12 Key Insight

> **You don't need deadlines if the system surfaces by age.** The longer something sits unchecked, the more it bubbles up — either you do it, or you consciously let it fade.

---

## Appendix C: Implementation Decisions (Finalized)

These decisions were finalized on 2026-01-14 for the Quiet Tasks MVP.

### Architecture Overview

The architecture is designed to scale from regex (Phase 1) to LLM-powered features (future):

```
┌─────────────────────────────────────────────────────────────────┐
│                      Note Created/Updated                        │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   DATABASE TRIGGER                               │
│              extract_tasks_from_note()                           │
│                                                                  │
│   • Checks user_intelligence_settings.tier1_enabled              │
│   • Extracts tasks via PostgreSQL regex                          │
│   • Inserts into note_tasks table                                │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     note_tasks TABLE                             │
└─────────────────────────────────────────────────────────────────┘
```

### Privacy Tiers

The architecture supports three privacy tiers for future extensibility:

| Tier | Processing | Privacy Exposure | Cost | Features |
|------|-----------|------------------|------|----------|
| **Tier 1** | Regex/SQL (server-side) | None — data stays in Supabase | Free | Quiet Tasks, Quiet Questions |
| Tier 2 | Embeddings | Medium — vectors sent to API | ~$0.0001/note | Resonance Threads |
| Tier 3 | LLM | High — content sent to LLM | ~$0.01/note | Daily Whisper, Weekly Digest |

**Phase 1 implements Tier 1 only** — users get Quiet Tasks without any third-party data sharing.

### Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Processing location** | Server-side (database trigger) | Notes already on Supabase — no additional privacy exposure. Always in sync, zero client load. |
| **When to extract** | On note save (via trigger) | Tasks extracted immediately when note is saved. No batch job needed. |
| **Storage** | Supabase `note_tasks` table | Enables cross-device sync and future email digest feature. |
| **LLM usage** | Start with regex only | Regex handles 80% of patterns. Graduate to LLM (Tier 3) for advanced features later. |

### UX Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Default behavior** | Opt-in | New feature, safer to let users discover and enable. Can flip to opt-out once validated. |
| **Opt-in storage** | `user_intelligence_settings` table | Dedicated table for all intelligence settings. More extensible than user_metadata. |
| **Initial surfacing** | Dedicated "Quiet Tasks" view | Self-contained, testable. Add in-app banner and email later. |
| **Surfacing frequency** | Max 3 per week | Avoid feeling naggy. Quality over quantity. |
| **Surface timing** | After 2 weeks (no deadline) | Gives user time to naturally complete before surfacing. |
| **Deadline hints** | Surface at ~50% of time until deadline | "before April" written in Jan → surface mid-Feb. |

### Behavior Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Snooze duration** | 1 week | Long enough to be useful, short enough to resurface. |
| **Max snoozes** | 2 times | After 2 snoozes, suggest "let it fade" more prominently. |
| **Auto-fade threshold** | 90 days untouched | Very old intentions auto-fade with notification. |
| **Completed visibility** | 7 days | Show "Completed Recently" for 1 week, then archive. |

### Privacy Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Sensitive topics in email** | Never | Health, medical, relationships, finances, legal — in-app only. |
| **User control** | Full visibility + delete | User can view ALL extracted intentions and delete any. |
| **Transparency** | Show trigger phrase | Display "Extracted from: I should..." so user understands why. |

### Settings UI Location

The opt-in toggle will be added to the Settings modal as a new "Intelligence" tab:

```
Settings Modal
├── Profile (existing)
├── Password (existing)
└── Intelligence (new)
    └── Quiet Tasks toggle
        └── "Surface intentions from your writing"
        └── [Off] [On]
```

### Scope Decision

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Include explicit checkboxes?** | Yes — include in MVP | Unified view is more useful. Users get one place to see ALL tasks. |

The Quiet Tasks view will show **both**:
1. **Explicit tasks** — Tiptap checkboxes (`- [ ] Call dentist`) aggregated from all notes
2. **Implicit intentions** — AI-extracted from prose (`"I should call Mom"`)

Each task type will be visually distinguished:
- Explicit: No indicator needed (user wrote it as a task)
- Implicit: Shows `💭 Extracted from: "I should..."` for transparency

### Monetization Decision

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **MVP pricing** | Free for all users | Experimenting — validate feature value before gating |
| **Future pricing** | Bloom tier ($4/mo) | Gate behind premium once validated |
| **Gating approach** | Soft prompts, not hard walls | Aligns with "calm monetization" philosophy |

See [subscription-architecture-claude.md](subscription-architecture-claude.md) for detailed payment/gating architecture (to be implemented post-MVP).

### Open Questions (Deferred)

These questions are deferred to future iterations:

| Question | Status |
|----------|--------|
| **Weekly email digest** | Deferred — requires email infrastructure |
| **In-app banner surfacing** | Deferred — start with dedicated view only |
| **Two-way checkbox sync** | Deferred — checking off in Quiet Tasks updates original note |
| **Premium feature gating** | Deferred — MVP is free; add gating after validation |

---

## Related Documents

- [Competitive Growth Plan](../active/competitive-growth-plan-claude.md) — Original AI strategy discussion
- [Strategic Viability Review](../active/strategic-viability-review-claude.md) — Competitive positioning
- [Monetization Philosophy](../active/monetization-philosophy.md) — Pricing approach
- [PRD](../prd.md) — Product requirements

---

*This analysis establishes the strategic foundation for Yidhan's "Quiet Intelligence" feature layer — AI that helps users reflect rather than produce.*
