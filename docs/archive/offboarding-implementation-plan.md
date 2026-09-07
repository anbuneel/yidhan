# Implementation Plan: User Offboarding ("Letting Go")

**Author:** Claude (Opus 4.5)
**Date:** 2025-12-25
**Design Doc:** `docs/analysis/offboarding-design-claude.md`
**Status:** ✅ IMPLEMENTED (v1.8.0, 2025-12-26)

---

## Implementation Summary

### Components Created
- **`LettingGoModal.tsx`** - Single modal for departure with keepsakes export (Markdown/JSON)
- **`WelcomeBackPrompt.tsx`** - Shown when departing user signs in during grace period

### AuthContext Updates
- `initiateOffboarding()` - Sets `departing_at` in user_metadata
- `cancelOffboarding()` - Clears `departing_at` to cancel departure
- `isDeparting` - Boolean indicating user is in grace period
- `daysUntilRelease` - Days remaining (1-14)

### User Flow
1. User clicks "Let go of Zenote →" link in Settings modal
2. LettingGoModal opens with:
   - Gratitude message: "Thank you for the quiet moments"
   - Export keepsakes option (Markdown or JSON)
   - "Stay a while" / "Let go" buttons
3. On "Let go": farewell toast, sign out
4. If user signs in during 14-day grace period: WelcomeBackPrompt appears
5. User can "Stay" (cancel departure) or "Continue letting go" (sign out again)

### Wabi-sabi Language
- "fade" instead of "delete"
- "release" instead of "permanently delete"
- "keepsakes" instead of "export"
- "stay a while" instead of "cancel"

### Technical Notes
- Uses Supabase `user_metadata.departing_at` - no database migration needed
- Grace period: 14 days from departure initiation
- Reuses existing export utilities (`exportNotesToJSON`, `downloadMarkdownZip`)

---

## Overview

Add graceful account deletion flow with 14-day grace period, data export, and return capability.

---

## Architecture Decision

**Store `departing_at` in `auth.users.user_metadata`** (not a custom table)

Rationale:
- No database migration needed
- Follows existing pattern (`full_name` also in metadata)
- Accessible via `user.user_metadata.departing_at`
- Supabase handles the storage

---

## Implementation Steps

### Phase 1: AuthContext Updates

**File:** `src/contexts/AuthContext.tsx`

Add to AuthContextType:
```typescript
initiateOffboarding: () => Promise<{ error: AuthError | null }>;
cancelOffboarding: () => Promise<{ error: AuthError | null }>;
isDeparting: boolean;
daysUntilRelease: number | null;
```

Implementation:
- `initiateOffboarding()`: Set `user_metadata.departing_at = new Date().toISOString()`
- `cancelOffboarding()`: Set `user_metadata.departing_at = null`
- `isDeparting`: Computed from `user?.user_metadata?.departing_at`
- `daysUntilRelease`: Calculate `14 - daysSinceDeparture`

---

### Phase 2: LettingGoModal Component

**File:** `src/components/LettingGoModal.tsx` (NEW)

Structure:
```
┌─────────────────────────────────────────┐
│              Letting Go             ✕   │
├─────────────────────────────────────────┤
│    Thank you for the quiet moments.     │
│    Your account will fade for 14 days.  │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  Take your keepsakes (optional)  │   │
│  │  [Markdown]  [JSON]              │   │
│  └─────────────────────────────────┘   │
│                                         │
│      [Stay a while]      [Let go]       │
└─────────────────────────────────────────┘
```

Props:
```typescript
interface LettingGoModalProps {
  isOpen: boolean;
  onClose: () => void;
  notes: Note[];
  tags: Tag[];
}
```

Behavior:
1. Export buttons reuse `exportNotesToJSON()` and `downloadMarkdownZip()`
2. "Stay a while" calls `onClose()`
3. "Let go" calls `initiateOffboarding()`, shows toast, signs out

---

### Phase 3: SettingsModal Update

**File:** `src/components/SettingsModal.tsx`

Add at bottom of modal (after theme toggle, before close):

```typescript
{/* Divider */}
<div className="my-6" style={{ borderTop: '1px solid var(--glass-border)' }} />

{/* Let go link */}
<div className="text-center">
  <p className="text-sm mb-2" style={{ color: 'var(--color-text-tertiary)' }}>
    Ready to move on?
  </p>
  <button
    onClick={() => {
      onClose();
      onLetGoClick();
    }}
    className="text-sm transition-colors hover:underline"
    style={{ color: 'var(--color-text-tertiary)' }}
  >
    Let go of Zenote →
  </button>
</div>
```

Add prop: `onLetGoClick: () => void`

---

### Phase 4: WelcomeBackPrompt Component

**File:** `src/components/WelcomeBackPrompt.tsx` (NEW)

Shown when user signs in during grace period:

```
┌─────────────────────────────────────────┐
│            Welcome back                 │
│                                         │
│    Your account is fading quietly.      │
│    Releasing in 11 days.                │
│                                         │
│      [Stay]    [Continue letting go]    │
└─────────────────────────────────────────┘
```

Props:
```typescript
interface WelcomeBackPromptProps {
  daysRemaining: number;
  onStay: () => void;
  onContinue: () => void;
}
```

Behavior:
- "Stay" calls `cancelOffboarding()`, shows "Welcome home" toast
- "Continue letting go" signs out

---

### Phase 5: App.tsx Integration

**File:** `src/App.tsx`

1. Add state for LettingGoModal:
```typescript
const [showLettingGoModal, setShowLettingGoModal] = useState(false);
```

2. Add state for WelcomeBackPrompt:
```typescript
const [showWelcomeBack, setShowWelcomeBack] = useState(false);
```

3. Check departing status on auth state change:
```typescript
useEffect(() => {
  if (user && isDeparting) {
    setShowWelcomeBack(true);
  }
}, [user, isDeparting]);
```

4. Pass `onLetGoClick` to SettingsModal:
```typescript
<SettingsModal
  ...
  onLetGoClick={() => setShowLettingGoModal(true)}
/>
```

5. Render new modals:
```typescript
<LettingGoModal
  isOpen={showLettingGoModal}
  onClose={() => setShowLettingGoModal(false)}
  notes={notes}
  tags={tags}
/>

{showWelcomeBack && (
  <WelcomeBackPrompt
    daysRemaining={daysUntilRelease}
    onStay={handleStay}
    onContinue={handleContinueDeparture}
  />
)}
```

---

### Phase 6: Farewell Toast

After "Let go" is clicked (follows Zen-style pattern like network toasts):

```typescript
toast('Your account is fading quietly. See you if you return.', {
  duration: 5000,
  style: {
    background: 'var(--color-bg-secondary)',
    color: 'var(--color-text-primary)',
    border: '1px solid var(--glass-border)',
  },
});
await signOut();
```

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/contexts/AuthContext.tsx` | MODIFY | Add offboarding methods |
| `src/components/LettingGoModal.tsx` | CREATE | Single modal for departure |
| `src/components/WelcomeBackPrompt.tsx` | CREATE | Grace period return prompt |
| `src/components/SettingsModal.tsx` | MODIFY | Add "Let go" link |
| `src/App.tsx` | MODIFY | Integrate new modals |
| `src/data/changelog.ts` | MODIFY | Add version entry |
| `CLAUDE.md` | MODIFY | Document feature |

---

## No Database Migration Needed

Using `user_metadata` means:
- No SQL migration
- No RLS policy changes
- No type regeneration

The `departing_at` field is simply:
```typescript
await supabase.auth.updateUser({
  data: { departing_at: new Date().toISOString() }
});
```

---

## Future: Account Cleanup (Not in Scope)

Permanent deletion after 14 days requires:
- Server-side cron job (Supabase Pro plan)
- Or manual cleanup script
- Or Edge Function triggered by webhook

This can be implemented later. For now, accounts remain in "fading" state until manually cleaned up.

---

## Testing Checklist

- [x] "Let go of Zenote" link appears in Settings
- [x] LettingGoModal opens with export options
- [x] Markdown/JSON export works from modal
- [x] "Let go" sets departing_at and signs out
- [x] Farewell toast appears
- [x] Sign in during grace period shows WelcomeBackPrompt
- [x] "Stay" clears departing_at, shows "Welcome home" toast
- [x] "Continue letting go" signs out again
- [x] Days remaining calculation is accurate
