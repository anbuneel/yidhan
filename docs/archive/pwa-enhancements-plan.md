# PWA Enhancements Implementation Plan

**Author:** Claude (Opus 4.5)
**Date:** 2026-01-08
**Status:** In Progress

---

## Overview

Complete the remaining PWA enhancements for Zenote:
1. **Share Target** - Accept shared text from other apps
2. **Custom Install Prompt** - Zen-styled prompt after engagement
3. **Landing Page Install CTA** - Subtle install option

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `vite.config.ts` | Modify | Add share_target to manifest |
| `src/hooks/useShareTarget.ts` | Create | Handle incoming shared data |
| `src/hooks/useInstallPrompt.ts` | Create | Manage install prompt + engagement |
| `src/components/InstallPrompt.tsx` | Create | Zen-styled install prompt UI |
| `src/components/LandingPage.tsx` | Modify | Add install CTA to footer nav |
| `src/App.tsx` | Modify | Integrate share target + install prompt |

---

## 1. Share Target

### Manifest Config (vite.config.ts)

Add to existing PWA manifest:

```typescript
share_target: {
  action: '/?share=true',
  method: 'GET',
  params: {
    title: 'title',
    text: 'text',
    url: 'url',
  },
},
```

### useShareTarget Hook

- Parse `?share=true&title=X&text=Y&url=Z` query params on app load
- Store in localStorage (`zenote-shared-content`) for unauthenticated users
- Clean URL after processing (prevent re-processing on refresh)
- Provide `formatSharedContent()` to convert to note title/content

### App.tsx Integration

- **Authenticated users**: Auto-create note from shared data, navigate to editor
- **Unauthenticated users**: Store share data, open signup modal, migrate after auth

---

## 2. Custom Install Prompt

### useInstallPrompt Hook

**Engagement Tracking:**
- Track notes created (stored in localStorage)
- Track unique visit days
- Threshold: 3+ notes OR 2+ visits

**beforeinstallprompt Handling:**
- Capture event using useSyncExternalStore (singleton pattern)
- Store deferred prompt for later use
- Detect if already installed via `display-mode: standalone`

**State Management:**
- `isInstallable`: prompt event captured
- `isInstalled`: running as PWA
- `shouldShowPrompt`: engaged + not dismissed + not previously prompted
- `triggerInstall()`: show native prompt
- `dismissPrompt()`: never show again

### InstallPrompt Component

- Fixed position bottom center
- Wabi-sabi styling (asymmetric corners, accent colors)
- Fade-in animation on mount
- Phone icon + "Add Zenote to your device"
- "Quick access, works offline" subtitle
- Install button + dismiss X

---

## 3. Landing Page Install CTA

Add to footer nav (after GitHub link):

```tsx
{isInstallable && !isInstalled && (
  <>
    <span>·</span>
    <button onClick={triggerInstall}>
      <DownloadIcon /> Install
    </button>
  </>
)}
```

Subtle, matches existing nav style.

---

## Implementation Sequence

1. **useInstallPrompt hook** - Foundation for install features
2. **InstallPrompt component** - UI for engaged users
3. **LandingPage install CTA** - Subtle landing page option
4. **useShareTarget hook** - Handle incoming shares
5. **vite.config.ts** - Enable share target in manifest
6. **App.tsx integration** - Wire everything together

---

## Verification

### Manual Testing

1. **Install Prompt:**
   - Chrome DevTools > Application > Manifest > "Add to homescreen"
   - Create 3 notes, verify prompt appears
   - Dismiss prompt, verify it doesn't reappear
   - Click Install, verify native prompt shows

2. **Share Target (Android Chrome):**
   - Install PWA on Android device
   - Share text from another app (browser, Twitter)
   - Verify Zenote appears in share sheet
   - Verify note is created with shared content

3. **Landing Page:**
   - Visit landing page in installable browser
   - Verify "Install" link appears in footer
   - Click Install, verify native prompt

### Run Checks

```bash
npm run check
```

---

## Complexity Assessment

| Dimension | Rating | Notes |
|-----------|--------|-------|
| **Scope** | Medium | 6 files, ~400 lines new code |
| **Risk** | Low | Progressive enhancement, graceful fallbacks |
| **Dependencies** | None | Uses existing vite-plugin-pwa |
| **Breaking Changes** | None | All features are additive |

**Overall: MEDIUM complexity, LOW risk**
