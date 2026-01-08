# iOS PWA Experience Checklist (Codex)

**Version:** 1.0
**Last Updated:** 2026-01-08
**Status:** Draft
**Author:** Codex (GPT-5)
**Date/Timestamp:** 2026-01-08 17:14

---

## Original Prompt

> how do i get an good mobile experrince on ios without building a native swift app
> go ahead and save it in docs

---

## Goal

Deliver a strong iOS experience using Safari + Add to Home Screen, without a native Swift app. Focus on install UX, keyboard stability, offline reliability, and performance polish.

---

## iOS Constraints to Design Around

- No `beforeinstallprompt` on iOS: custom install guidance is required.
- Background Sync is not reliable; use manual retry + visible sync state.
- Share Target receive is not supported on iOS; keep outbound sharing via `navigator.share`.
- Viewport and safe-area behavior differs; keyboard resizes can cause layout jumps.
- Service worker caching is supported but can be memory constrained.

---

## Checklist

### 1) Install Experience (iOS Safari)
- Detect iOS Safari and show a gentle, one-time banner with steps: Share -> Add to Home Screen.
- Store dismissal state in localStorage; avoid prompting if already installed.
- Add apple meta tags and touch icons.

```html
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Zenote">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<link rel="apple-touch-icon" href="/icons/icon-180.png">
```

### 2) App Shell + Safe Areas
- Use `env(safe-area-inset-*)` for padding on bottom/top.
- Use `100dvh` instead of `100vh` to reduce address bar jump.
- Avoid fixed elements in the main editor when the keyboard is open.

```css
body { min-height: 100dvh; -webkit-text-size-adjust: 100%; }
.safe-bottom { padding-bottom: env(safe-area-inset-bottom); }
```

### 3) Keyboard and Focus Stability
- Use `visualViewport` height to adjust bottom UI if needed.
- Avoid reflow loops when `focus` changes; keep editor height stable.
- Ensure editor retains cursor position on orientation changes.

### 4) Offline Reliability (Feels "Native")
- Persist edits locally first, then sync.
- Expose a clear offline indicator and a "retry sync" action.
- Prevent data loss on refresh (queue + conflict handling).

### 5) Performance (iOS Perceived Speed)
- Reduce layout thrash in the masonry grid (batch updates, avoid heavy reflow).
- Lazy load heavy UI (editor, settings, changelog).
- Defer non-critical work (analytics, large imports).

### 6) PWA Capabilities That Do Work on iOS
- Web Push for installed PWAs (iOS 16.4+).
- Outbound share with `navigator.share`.
- Home screen launch shortcuts are partially supported; include them but do not depend on them.

### 7) QA on Real Devices
- Test on real iPhone (not just simulator).
- Validate: install flow, offline edit, sync recovery, keyboard behavior, and orientation changes.
- Confirm "Add to Home Screen" opens in standalone with correct theme/status bar.

---

## Zenote-Specific Priorities

- Install banner for iOS Safari with calm, wabi-sabi styling.
- Editor stability under the keyboard (no jumping).
- Offline-first capture: instant save, reliable sync, visible status.
- Quick capture entry path (one-tap New Note; shortcuts optional).

---

## When to Consider a Wrapper (Not Full Native)

If you need App Store presence or native surfaces (widgets, shortcuts), use a Capacitor wrapper. This keeps one codebase and avoids Swift/Kotlin overhead.

