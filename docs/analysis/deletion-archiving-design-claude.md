# Zenote Deletion & Archiving Design System

> **Prompt**: Design a deletion and archiving system for Zenote, a calm note-taking app with wabi-sabi aesthetics. Currently we have "Faded Notes" (soft-delete with 30-day recovery). We need to determine: 1) Should we have separate Archive vs Delete flows? 2) What's the right UX for each? 3) How should archived/deleted notes be accessed and managed? 4) What visual language fits the Zen aesthetic? Consider patterns from apps like Apple Notes, Bear, Notion, and Obsidian. The design should feel intentional and calm, not cluttered with options.
>
> **Author**: Claude (Opus 4.5) via frontend-design skill
> **Date**: 2025-12-24

---

## Design Philosophy

### The Wabi-Sabi Approach to Note Lifecycle

Wabi-sabi teaches us to embrace impermanence—nothing lasts, and that's beautiful. Rather than fighting entropy with complex archival systems, Zenote should honor the natural lifecycle of thoughts and notes.

**Core Principle**: Notes, like thoughts, naturally arise, serve their purpose, and gently fade away. This isn't loss—it's completion.

---

## Competitive Analysis

| App | Delete Flow | Archive Flow | Philosophy |
|-----|-------------|--------------|------------|
| **Apple Notes** | Trash → 30 days → gone | None | Simple, time-based |
| **Bear** | Trash + Archive separate | Tags + Archive folder | Collector's approach |
| **Notion** | Trash with restore | Move to different pages | Organizational flexibility |
| **Obsidian** | Trash folder | None (vault-based) | File-system philosophy |
| **Things 3** | Delete → Logbook | Logbook is archive | Completion-based |

### Key Insight
The most "zen" apps (Apple Notes, iA Writer) keep it simple: one delete flow, time-based recovery, no archive. The collector-oriented apps (Notion, Bear) add complexity for power users.

---

## Recommendation: Enhanced "Faded Notes" (No Separate Archive)

### Why NOT to Add Archive

1. **Contradicts Wabi-Sabi**: Archiving implies permanent preservation. Wabi-sabi embraces impermanence.

2. **Decision Paralysis**: "Should I archive or delete?" adds cognitive load to what should be a simple action.

3. **Graveyard Problem**: Archives become graveyards of notes no one reads. They accumulate guilt, not value.

4. **Current System Works**: "Faded Notes" already provides safety (30 days) without permanent commitment.

### The Zenote Way

```
Active Notes  →  Faded Notes  →  Gone
   (living)       (resting)      (released)
```

**One action, one destination, one philosophy**: When you're done with a note, release it. It will rest in Faded Notes, giving you time to reconsider. Then it's gone—and that's okay.

---

## Enhanced Faded Notes Design

### Visual Language

#### 1. The "Fade" Animation
When a note is deleted, it shouldn't just disappear. It should **gently fade**:

```
Opacity: 100% → 60% (over 300ms)
Scale: 100% → 98%
Position: slides slightly down (8px)
Then: removed from view
```

#### 2. Faded Notes Aesthetic

The Faded Notes view should feel like:
- **Paper left in sunlight** - warm, aged, weathered
- **Memories at the edge of recall** - present but softening
- **Autumn leaves** - beautiful in their transition

**Visual treatments**:
- Reduced opacity (70-80%) on cards
- Warmer, sepia-shifted colors
- Softer shadows
- Typography slightly lighter weight
- Subtle paper texture overlay

#### 3. Time Indicators

Instead of clinical "27 days left", use organic language:

| Days Remaining | Display Text |
|----------------|--------------|
| 25-30 | "Just arrived" |
| 15-24 | "Resting quietly" |
| 7-14 | "Fading gently" |
| 1-6 | "Nearly gone" |
| <1 day | "Releasing today" |

#### 4. Empty State

When Faded Notes is empty:

```
┌─────────────────────────────────────┐
│                                     │
│            ○ ○ ○                    │
│                                     │
│      Nothing fading away            │
│                                     │
│   All your notes are still          │
│   with you in the library           │
│                                     │
└─────────────────────────────────────┘
```

---

## Interaction Design

### Delete Action (Library & Editor)

**Trigger**: Click delete button on card or in editor

**Behavior**:
1. No confirmation dialog for delete (reduces friction)
2. Note gently animates out
3. Toast appears: "Note moved to Faded Notes" with **Undo** button (5 seconds)
4. Undo restores immediately with reverse animation

**Rationale**: The 30-day recovery window IS the safety net. We don't need a confirmation dialog that interrupts flow.

### Faded Notes View

**Layout**:
```
┌─────────────────────────────────────────────────────────┐
│ ← Back to Notes                          [Release All]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│                    Faded Notes                          │
│         Notes rest here before releasing                │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Morning Thoughts                    [Restore ↺] │   │
│  │ Just arrived · Releasing in 29 days             │   │
│  │                                     [Release ○] │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Old Project Notes                   [Restore ↺] │   │
│  │ Fading gently · Releasing in 12 days            │   │
│  │                                     [Release ○] │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Key Changes**:
- "Delete Forever" → **"Release"** (softer language)
- "Deleted X days ago" → **"Releasing in X days"** (forward-looking)
- "Empty All" → **"Release All"** with confirmation

### Release Confirmation

Only show confirmation for "Release" (permanent delete) and "Release All":

```
┌─────────────────────────────────────┐
│                                     │
│         Release this note?          │
│                                     │
│   Once released, this note will     │
│   be gone. This is a gentle         │
│   goodbye, not a deletion.          │
│                                     │
│      [Keep Resting]  [Release]      │
│                                     │
└─────────────────────────────────────┘
```

**Button styling**:
- "Keep Resting" - secondary, subtle
- "Release" - not red, but muted accent (terracotta in light, soft gold in dark)

---

## Alternative Consideration: "Quiet Notes"

If user feedback indicates need for long-term storage without cluttering the library, consider a **Quiet Notes** feature as a future enhancement:

**Concept**: Notes you want to keep but not see daily. Like a drawer in your desk.

**Behavior**:
- Notes remain indefinitely (no countdown)
- Accessed via menu (like Faded Notes)
- Searchable from main library
- No visual badge/count (out of sight, out of mind)

**Visual**:
- Cards appear slightly muted
- "Sleeping" indicator
- Can be "awakened" back to active library

**Implementation note**: This would require a new database field (`quieted_at` or `archived_at`). Only add if user research indicates genuine need. For now, the Pinned feature + Faded Notes covers most use cases.

---

## Color & Typography for Faded Notes

### Color Treatment

**Light Theme (Kintsugi)**:
```css
--faded-bg: #F5F0E8;           /* Warmer, aged paper */
--faded-text: #8B8178;         /* Stone, reduced contrast */
--faded-accent: #C2563480;     /* Terracotta at 50% */
--faded-overlay: rgba(139, 129, 120, 0.05);
```

**Dark Theme (Midnight)**:
```css
--faded-bg: #1a2420;           /* Slightly lighter than primary */
--faded-text: #6B7D6B;         /* Muted forest */
--faded-accent: #D4AF3780;     /* Gold at 50% */
--faded-overlay: rgba(212, 175, 55, 0.03);
```

### Typography

Faded notes should use:
- Same fonts (Cormorant Garamond / Inter)
- Slightly lighter weight (400 → 300 for body)
- Increased letter-spacing (+0.01em)
- Creates "whisper" effect - words becoming less substantial

---

## Implementation Summary

| Aspect | Current | Recommended |
|--------|---------|-------------|
| Archive feature | None | **Don't add** - embraces wabi-sabi |
| Delete confirmation | Dialog | **Toast with undo** - reduces friction |
| "Delete Forever" | Red button | **"Release"** - gentler language |
| Time display | "X days left" | **Organic phrases** - "Fading gently" |
| Visual treatment | Standard cards | **Faded aesthetic** - opacity, warmth |
| Empty All | Available | **"Release All"** - with confirmation |

### Implementation Priority

**Phase 1 - Quick wins** (low effort, high impact): ✅ COMPLETED
- [x] Change "Delete Forever" to "Release"
- [x] Change "Empty All" to "Release All"
- [x] Add undo toast for delete action (remove confirmation dialog)
- [x] Update empty state copy
- [x] Update subtitle to "Notes rest here before releasing"

**Phase 2 - Visual enhancements** (medium effort): ✅ COMPLETED
- [x] Fade animation on delete
- [x] Organic time phrases ("Fading gently", "Nearly gone")
- [x] Forward-looking time ("Releasing in X days" vs "Deleted X days ago")
- [x] Muted card styling in Faded Notes view

**Phase 3 - Backend & Future**:
- [x] Client-side auto-cleanup of expired notes (runs on app load)
- [x] SQL migration prepared for Supabase pg_cron (for Pro plan)
- [ ] "Quiet Notes" feature if user research supports it

---

## Implementation Details (Completed 2025-12-24)

### Phase 1: Language & UX Changes

| Change | Before | After |
|--------|--------|-------|
| Delete button | "Delete Forever" | **"Release"** |
| Cancel button | "Cancel" | **"Keep Resting"** |
| Empty all | "Empty All" | **"Release All"** |
| Time display | "27 days left" | **"Releasing in 27 days"** |
| Confirmation | "This cannot be undone" | **"This is a gentle goodbye"** |
| Button color | Red (destructive) | **Accent color** (terracotta/gold) |
| Delete action | Confirmation dialog | **Toast with Undo** (5 sec) |
| Empty state | "Deleted notes will appear..." | **"All your notes are still with you..."** |
| Subtitle | "...permanently removed after 30 days" | **"Notes rest here before releasing"** |

### Phase 2: Visual Enhancements

#### 1. Fade Animation on Delete
- Notes fade out (opacity → 0.4, scale → 0.98, slide down 8px)
- 300ms animation before removal
- Removed confirmation dialog (undo toast is the safety net now)

#### 2. Organic Time Phrases
| Days Remaining | Phrase |
|----------------|--------|
| 25-30 | *Just arrived* |
| 15-24 | *Resting quietly* |
| 7-14 | *Fading gently* |
| 1-6 | *Nearly gone* |
| 0 | *Releasing today* |

#### 3. Enhanced Faded Card Styling
- **Sepia tint** - `filter: sepia(0.08)` for aged paper feel
- **Reduced saturation** - 60% for muted colors
- **Softer shadows** - `0 2px 8px rgba(0, 0, 0, 0.06)`
- **Lighter typography** - `font-medium` instead of `font-semibold`
- **Secondary text color** - Title uses `--color-text-secondary`
- **Letter spacing** - +0.01em for "whisper" effect

### Backend: Auto-Release Expired Notes

**Client-side cleanup** (active now):
```typescript
// Runs on app load before fetching faded notes count
cleanupExpiredFadedNotes()
  .then(() => countFadedNotes())
  .then(setFadedNotesCount)
```

**Server-side cleanup** (ready for Supabase Pro):
```sql
-- Daily cron job at 3 AM UTC
SELECT cron.schedule(
  'cleanup-faded-notes',
  '0 3 * * *',
  'SELECT cleanup_expired_faded_notes()'
);
```

Migration file: `supabase/migrations/add_faded_notes_cleanup_cron.sql`

---

## The Zen Perspective

> "The art of letting go is the art of living. We don't delete notes—we release them back into the void from which they came. The 30-day window isn't a trash can; it's a gentle transition, a chance to say goodbye."

This design embraces the core Zenote philosophy: **a quiet space for your mind**. Notes come and go like thoughts—we hold them gently, and when it's time, we let them fade away.

---

*Design document created for Zenote by Claude (Opus 4.5)*
