# iOS PWA Experience Checklist

**Version:** 1.2
**Last Updated:** 2026-01-08
**Status:** In Progress
**Author:** Codex (GPT-5), reviewed by Claude (Opus 4.5)
**Date/Timestamp:** 2026-01-08

---

## Original Prompt

> how do i get an good mobile experrince on ios without building a native swift app
> go ahead and save it in docs

---

## Goal

Deliver a strong iOS experience using Safari + Add to Home Screen, without a native Swift app. Focus on install UX, keyboard stability, offline reliability, and performance polish.

---

## Closed Items (As Of 2026-01-08)

- Apple PWA meta tags + touch icon in `index.html`.
- Safe-area padding + `100dvh` for mobile viewport stability in `src/index.css`.
- Offline-first storage + sync queue (validate on iOS devices).
- Lazy-loading heavy UI (editor, settings, changelog).

---

## iOS Constraints to Design Around

- No `beforeinstallprompt` on iOS: custom install guidance is required.
- Background Sync is not reliable; use manual retry + visible sync state.
- Share Target receive is not supported on iOS; keep outbound sharing via `navigator.share`.
- Viewport and safe-area behavior differs; keyboard resizes can cause layout jumps.
- Service worker caching is supported but can be memory constrained.
- IndexedDB storage quotas are stricter on Safari than Chrome.
- iOS swipe-from-edge gesture can conflict with in-app navigation.

---

## Checklist

### 1) Install Experience (iOS Safari)
- [ ] Detect iOS Safari and show a gentle, one-time banner with steps: Share → Add to Home Screen.
- [ ] Store dismissal state in localStorage; avoid prompting if already installed.
- [ ] Detect standalone mode with `window.matchMedia('(display-mode: standalone)')` to skip banner for installed users.
- [x] Add apple meta tags and touch icons (index.html).
- [ ] Add `apple-touch-startup-image` splash screens to prevent white flash on launch.

```html
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Zenote">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<link rel="apple-touch-icon" href="/icons/icon-180.png">
<!-- Splash screens for various iOS devices -->
<link rel="apple-touch-startup-image" href="/splash/splash-1170x2532.png"
      media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)">
```

### 2) App Shell + Safe Areas
- [x] Use `env(safe-area-inset-*)` for padding on bottom/top (src/index.css).
- [x] Use `100dvh` instead of `100vh` to reduce address bar jump (src/index.css).
- [ ] Avoid fixed elements in the main editor when the keyboard is open (needs device validation).
- [ ] Consider `overscroll-behavior: none` to disable pull-to-refresh if it conflicts with UI.
- [ ] Add left edge padding (~20px) to avoid conflicts with iOS swipe-back gesture.

```css
body { min-height: 100dvh; -webkit-text-size-adjust: 100%; }
.safe-bottom { padding-bottom: env(safe-area-inset-bottom); }
/* Disable pull-to-refresh if needed */
html, body { overscroll-behavior: none; }
```

### 3) Keyboard and Focus Stability
- [ ] Use `visualViewport` API to adjust bottom UI when keyboard opens.
  - **Caveat:** `visualViewport.resize` fires frequently on iOS; debounce handlers.
- [ ] Prefer `position: sticky` over `position: fixed` for toolbars (more stable with keyboard).
- [ ] Avoid reflow loops when `focus` changes; keep editor height stable (partial CSS scroll-margin in src/index.css).
- [ ] Ensure editor retains cursor position on orientation changes (needs iOS validation).

```javascript
// Example: visualViewport resize handling (debounced)
let resizeTimeout;
window.visualViewport?.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    document.documentElement.style.setProperty(
      '--viewport-height',
      `${window.visualViewport.height}px`
    );
  }, 100);
});
```

### 4) Offline Reliability (Feels "Native")
- [x] Persist edits locally first, then sync (offline IDB + sync queue implemented).
- [ ] Expose a clear offline indicator and a "retry sync" action.
- [x] Prevent data loss on refresh (queue + conflict handling implemented; validate on iOS).
- [ ] Monitor IndexedDB storage usage; warn user if approaching Safari's stricter quota limits.

```javascript
// Check storage quota (Safari has ~50MB limit for origin)
if (navigator.storage?.estimate) {
  const { usage, quota } = await navigator.storage.estimate();
  const percentUsed = (usage / quota) * 100;
  if (percentUsed > 80) {
    // Show warning to user
  }
}
```

### 5) Performance (iOS Perceived Speed)
- [ ] Reduce layout thrash in the masonry grid (batch updates, avoid heavy reflow).
- [x] Lazy load heavy UI (editor, settings, changelog).
- [ ] Defer non-critical work (analytics, large imports).

### 6) PWA Capabilities That Work on iOS
- [ ] Web Push for installed PWAs (iOS 16.4+). **Low priority for Zenote's calm philosophy.**
- [x] Outbound share with `navigator.share` (implemented in Share as Letter).
- [ ] Home screen launch shortcuts are partially supported; include them but do not depend on them.

### 7) QA on Real Devices
- [ ] Test on real iPhone (not just simulator).
- [ ] Validate: install flow, offline edit, sync recovery, keyboard behavior, and orientation changes.
- [ ] Confirm "Add to Home Screen" opens in standalone with correct theme/status bar.

---

## Zenote-Specific Priorities

**High Priority:**
1. iOS install banner with calm, wabi-sabi styling (biggest gap for iOS users)
2. Keyboard stability validation on real devices (user-facing pain point)
3. Real device testing matrix (catches simulator misses)

**Medium Priority:**
4. Splash screen images (polish, prevents white flash)
5. Storage quota monitoring (prevent data loss edge cases)
6. Edge gesture padding (avoid swipe-back conflicts)

**Lower Priority:**
7. Pull-to-refresh customization (only if it conflicts)
8. Web Push notifications (conflicts with calm philosophy)

---

## When to Consider a Wrapper (Not Full Native)

If you need App Store presence or native surfaces (widgets, shortcuts), use a Capacitor wrapper. This keeps one codebase and avoids Swift/Kotlin overhead.

---

## Review Notes (Claude)

**Added in v1.2:**
- Standalone mode detection for smarter install banner logic
- Splash screen (`apple-touch-startup-image`) recommendation
- `overscroll-behavior` for pull-to-refresh control
- Edge padding for iOS swipe-back gesture conflicts
- `visualViewport` debounce caveat and code example
- `position: sticky` preference over `position: fixed`
- IndexedDB storage quota monitoring with code example
- Deprioritized Web Push for Zenote's calm philosophy
- Marked `navigator.share` as implemented
- Reorganized priorities into High/Medium/Lower tiers
- Added iOS-specific constraints (storage quotas, edge gestures)
