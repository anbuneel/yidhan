# Zenote Offboarding Design: "Letting Go"

**Author:** Claude (Opus 4.5)
**Date:** 2025-12-25
**Consulted:** Frontend Design Skill

---

## Original Prompt

> Design a user offboarding/account deletion flow for Zenote with:
> - Account deletion flow (net new feature)
> - Data export before deletion
> - Grace period before permanent deletion
> - Graceful and easy - no guilt-tripping, no dark patterns
> - Aligned with wabi-sabi philosophy

---

## Design Philosophy

Wabi-sabi teaches us that **departure is as natural as arrival**. Like autumn leaves releasing from branches, a user's departure should feel inevitable, graceful, and without friction. No guilt. No barriers. Just gratitude and a gentle goodbye.

---

## Core Concept: "Letting Go"

**Language palette:**
- "Let go" (not delete)
- "Depart" (not cancel)
- "Release" (not terminate)
- "Keepsakes" (not export/download)
- "Return" (not reactivate)

**Emotional tone:** A friend leaving a tea house, bowing gently at the door. Not a customer canceling a subscription.

---

## The Journey (Simplified)

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   Settings Modal       Letting Go Modal         Grace Period       │
│   ─────────────       ─────────────────        ────────────        │
│                                                                     │
│   [Let go of    →     [Keepsakes export]       Account fades       │
│    Zenote]            [Let go button]          for 14 days         │
│                              │                       │             │
│                              ↓                  [Return?]          │
│                       Toast + Sign out               │             │
│                                                 [Release]          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Design Principle:** Minimize friction. The 14-day grace period IS the safety net — no need for extra confirmation steps.

---

## Step-by-Step Flow

### Step 1: Entry Point in Settings Modal

Add a section at the bottom of the Settings modal:

```
┌─────────────────────────────────────────┐
│  Settings                           ✕   │
├─────────────────────────────────────────┤
│  [Profile]  [Password]                  │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  Display Name                    │   │
│  │  [_______________]               │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  Theme                           │   │
│  │  [Light] [Dark]                  │   │
│  └─────────────────────────────────┘   │
│                                         │
│─────────────────────────────────────────│
│                                         │
│  Ready to move on?                      │
│  Let go of Zenote →                     │  ← Subtle, tertiary text
│                                         │
└─────────────────────────────────────────┘
```

**Design notes:**
- Position at bottom, separated by divider
- Tertiary text color (not prominent, but not hidden)
- No red, no warning colors
- Arrow suggests a journey, not an action

---

### Step 2: Letting Go Modal (Single Modal)

When user clicks "Let go of Zenote", open a modal with everything in one place:

```
┌─────────────────────────────────────────┐
│              Letting Go             ✕   │
├─────────────────────────────────────────┤
│                                         │
│    Thank you for the quiet moments.     │
│                                         │
│  Your account will fade for 14 days,    │
│  then release. You may return anytime   │
│  before then.                           │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  Take your keepsakes (optional)  │   │
│  │                                  │   │
│  │  Your words belong to you.       │   │
│  │                                  │   │
│  │  [Markdown]  [JSON]              │   │
│  └─────────────────────────────────┘   │
│                                         │
│                                         │
│      [Stay a while]      [Let go]       │
│                                         │
└─────────────────────────────────────────┘
```

**Design notes:**
- Single modal contains everything: gratitude, explanation, export, action
- Keepsakes section is optional — user can skip if they don't need their data
- "Stay a while" dismisses modal, returns to Settings
- "Let go" initiates the departure
- No typing confirmation needed — grace period is the safety net

**Key copy:**
- "Thank you for the quiet moments" — gratitude, not guilt
- "fade for 14 days, then release" — echoes Faded Notes language
- "Your words belong to you" — empowering, respectful
- "Stay a while" — gentle, not "Cancel"

---

### Step 3: Farewell Toast + Sign Out

After clicking "Let go":

1. Show a gentle toast notification
2. Sign the user out
3. Redirect to landing page

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                        [Landing Page]                               │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Your account is fading quietly. See you if you return.    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                         ↑ Toast (fades after 5s)                    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Toast design:**
- Warm, not cold
- No warning icon
- Longer duration (5 seconds) so they can read it
- Same styling as other Zenote toasts

---

### Grace Period: The Fading Account

During the 14-day grace period, if user signs back in:

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                                                                     │
│                        Welcome back                                 │
│                                                                     │
│              ─────────────────────────────                          │
│                                                                     │
│         Your account is fading quietly.                             │
│                                                                     │
│              Releasing in 11 days.                                  │
│                                                                     │
│                                                                     │
│                                                                     │
│                [Stay]        [Continue letting go]                  │
│                                                                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**"Stay" behavior:**
- Cancels the departure
- Restores account to normal state
- Shows brief "Welcome home" toast

**"Continue letting go" behavior:**
- Signs them out again
- Grace period continues

---

## Visual Language

### Color Palette for Offboarding

| Element | Color | Reasoning |
|---------|-------|-----------|
| Background | Warm paper | Consistent with app |
| Headings | Primary text | No alarm colors |
| Body text | Secondary text | Calm, readable |
| Primary button | Gold/terracotta | Gentle emphasis |
| Secondary button | Transparent + border | Soft alternative |
| Keepsakes card | Subtle bg + border | Inviting, not urgent |

### Typography

| Element | Style |
|---------|-------|
| "Letting Go" | Cormorant Garamond, 2.5rem, italic |
| "Thank you..." | Cormorant Garamond, 1.25rem |
| Body text | Inter, 0.95rem |
| Buttons | Inter, medium weight |

### Animation

- Page transitions: Fade in (300ms ease-out)
- Farewell screen: Gentle fade with slight upward float (like leaves)
- No harsh transitions, no shake effects

---

## Copy Reference

### Headlines
- "Letting Go" (modal title)
- "Welcome back" (grace period return)

### Body Copy
- "Thank you for the quiet moments."
- "Your account will fade for 14 days, then release."
- "You may return anytime before then."
- "Your words belong to you."
- "Your account is fading quietly."

### Button Labels
- "Let go of Zenote →" (settings link)
- "Stay a while" (dismiss modal)
- "Let go" (confirm departure)
- "Stay" / "Continue letting go" (grace period return)

### Toast Messages
- "Your account is fading quietly. See you if you return." (farewell)
- "Welcome home" (on return during grace period)

### Micro-copy
- "Take your keepsakes (optional)"
- "Releasing in X days"
- "Ready to move on?"

---

## Technical Considerations

### Database
- Add `departing_at` timestamp to users table
- Null = active account
- Set = grace period active
- Cron job deletes accounts where `departing_at < now() - 14 days`

### Auth Flow
- Departing users can still sign in during grace period
- On sign-in, check `departing_at` and show restoration prompt
- "Stay" clears the `departing_at` field

### Data Export
- Reuse existing `exportNotesToJSON` and `downloadMarkdownZip` functions
- Run export before setting `departing_at`

### Email (Optional, Future)
- "Your account is fading" — sent on departure
- "7 days until release" — gentle reminder
- "Your account has been released" — final confirmation

---

## Component Structure (Simplified)

```
src/components/
├── SettingsModal.tsx        # Add "Let go" link at bottom
├── LettingGoModal.tsx       # New: Single modal for departure (export + confirm)
├── WelcomeBackPrompt.tsx    # New: Shown on sign-in during grace period
```

**Note:** No separate confirmation modal, departure page, or farewell screen needed. The single modal + toast approach keeps it minimal.

---

## What This Design Avoids

| Anti-pattern | Our approach |
|--------------|--------------|
| "Are you SURE?" warnings | Grace period is the safety net |
| Red delete buttons | Gold/terracotta accent |
| "We're sorry to see you go" | "Thank you for the quiet moments" |
| Hidden deletion options | Visible but subtle |
| Immediate deletion | 14-day grace period |
| Complex multi-step flows | Single modal, one click |
| Typing confirmation | Unnecessary friction |
| Guilt-inducing copy | Gratitude and respect |
| Exit surveys | No interrogation |

---

## Alignment with Onboarding

This offboarding design mirrors the onboarding philosophy:

| Onboarding | Offboarding |
|------------|-------------|
| Demo content migration | Keepsakes export |
| "Save this note" CTA | "Take your keepsakes" |
| Welcome note for new users | "Thank you for the quiet moments" |
| Gentle email confirmation | Gentle departure confirmation |
| Can explore before committing | Can return during grace period |

Both flows respect user autonomy and avoid pressure tactics.

---

## Summary

The Zenote offboarding experience embodies wabi-sabi: **departure is natural, not a failure**. Users should feel respected, not retained. The 14-day grace period mirrors the Faded Notes pattern, and the language throughout evokes seasonal change — leaves falling, not contracts terminating.
