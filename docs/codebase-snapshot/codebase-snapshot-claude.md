# Codebase Snapshot Timeline

This document tracks the evolution of the Yidhan codebase over time.

---

## Snapshot: 2026-01-17 at 13:58 EST

**Author:** Claude (Opus 4.5)
**Captured:** 2026-01-17T13:58:32-05:00
**Commit:** 9d7f09f (main branch)
**Release:** v2.7.0 - Mobile Polish Improvements (PR #74)

### Architecture Overview

The Yidhan application follows a layered architecture pattern with enhanced mobile-native components:

- **Presentation Layer:** Core views (LandingPage, ChapteredLibrary, Editor, etc.), mobile components, modals
- **State Management:** App.tsx (notes, tags, UI), AuthContext (session, OAuth), useDemoState (demo mode)
- **Service Layer:** notes.ts, tags.ts, syncEngine.ts, demoStorage.ts
- **Hooks Layer:** 12 custom hooks for sync, UI, PWA, auth
- **External Services:** Supabase (DB + Auth), Vercel (hosting), Sentry (monitoring), Capacitor (native)

### New Components in PR #74

**BottomSheet** (src/components/BottomSheet.tsx - 293 lines)
- iOS-style bottom sheet modal with spring animations
- Drag-to-dismiss gesture with velocity detection (100px threshold or 0.5 velocity)
- Desktop fallback to centered modal
- Uses @react-spring/web for physics-based animations
- Safe area inset support for iPhone notch/home indicator
- useKeyboardHeight integration for keyboard-aware sizing

**GestureHint** (src/components/GestureHint.tsx - 266 lines)
- One-time overlay teaching swipe gestures
- Animated swipe indicators (left=delete, right=pin)
- Persists dismissal in localStorage (yidhan-gesture-hint-seen)
- 1 second entrance delay
- Accessibility: ESC key to dismiss, ARIA modal roles

**useKeyboardHeight** (src/hooks/useKeyboardHeight.ts - 93 lines)
- Visual Viewport API for keyboard detection
- Sets CSS variables (--keyboard-height, --keyboard-visible)
- Handles address bar vs keyboard height differentiation (50px threshold)
- useKeyboardVisible boolean helper (150px threshold)

**SettingsModal Refactor**
- Now uses BottomSheet wrapper
- Slides up from bottom on mobile
- Centered modal on desktop
- Touch-friendly tab buttons

### Code Metrics

| Metric | Count |
|--------|-------|
| Total Lines of Code | ~30,100 |
| TypeScript TSX | 14,074 |
| TypeScript TS (non-test) | 7,136 |
| Test Files | 5,753 lines |
| CSS (index.css) | 1,045 |
| E2E Tests | 1,113 lines |
| React Components | 45 |
| Custom Hooks | 12 |
| E2E Spec Files | 6 |
| SQL Migrations | 324 |

### Tech Stack

| Category | Technology | Version |
|----------|------------|---------|
| Frontend | React | 19.2.0 |
| Language | TypeScript | 5.9.3 |
| Build | Vite | 7.2.4 |
| Styling | Tailwind CSS | 4.1.17 |
| Editor | Tiptap (ProseMirror) | 3.13.0 |
| Layout | react-masonry-css | 1.0.16 |
| Backend | Supabase | 2.86.2 |
| Offline | Dexie (IndexedDB) | 4.2.1 |
| Gestures | @use-gesture/react | 10.3.1 |
| Animation | @react-spring/web | 10.0.3 |
| Native | Capacitor | 8.0.0 |
| Monitoring | Sentry | 10.30.0 |
| Testing | Vitest + Playwright | 4.0.15 / 1.57.0 |

### Production Deployment

- **Live URL:** https://yidhan.vercel.app
- **Platform:** Vercel (auto-deploy from main)
- **Repository:** https://github.com/anbuneel/yidhan
- **CI/CD:** GitHub Actions (typecheck, lint, test, build)
- **PWA:** Installable, offline shell, Share Target, Apple splash screens
- **Native:** Android APK via Capacitor

### Component Inventory (45 total)

**Core Views (8):**
LandingPage, ChapteredLibrary, DemoPage, Editor, FadedNotesView, ChangelogPage, RoadmapPage, SharedNoteView

**Mobile-Native (5):**
- SwipeableNoteCard - Swipe gestures (left=delete, right=pin)
- PullToRefresh - Pull-down refresh with spring physics
- IOSInstallGuide - PWA install tutorial for Safari
- BottomSheet [NEW] - iOS-style modal with drag-to-dismiss
- GestureHint [NEW] - One-time swipe gesture tutorial

**Modal Components (10):**
SettingsModal, TagModal, ShareModal, LettingGoModal, ConflictModal, InstallPrompt, InvitationModal, KeyboardShortcutsModal, SessionTimeoutModal, Auth

**Shared Components (22):**
ChapterNav, ChapterSection, EditorToolbar, ErrorBoundary, FadedNoteCard, Footer, Header, HeaderShell, LoadingFallback, NoteCard, ReloadPrompt, RichTextEditor, SlashCommand, SyncIndicator, TagBadge, TagFilterBar, TagPill, TagSelector, TimeRibbon, WelcomeBackPrompt, WhisperBack, ImpermanenceRibbon

### Hooks Inventory (12 total)

| Hook | Purpose |
|------|---------|
| useNetworkStatus | Network monitoring (Capacitor + browser) |
| useSyncEngine | Sync engine React integration |
| useSyncStatus | Sync state for UI (pending count, online) |
| useViewTransition | View Transitions API wrapper |
| useInstallPrompt | PWA install with engagement tracking |
| useShareTarget | Share Target API handler |
| useDemoState | Demo mode state management |
| useSoftPrompt | Soft signup prompt triggers |
| useMobileDetect | Touch/mobile device detection |
| useSessionTimeout | 30-min inactivity auto-logout |
| useKeyboardHeight [NEW] | Visual Viewport API keyboard detection |
| useKeyboardVisible [NEW] | Boolean keyboard visibility helper |

### CSS Enhancements in v2.7.0

**Touch Press States:**
- .touch-press - Scale to 0.96 on tap
- .touch-press-light - Scale to 0.98 for smaller elements

**Gesture Hint Animations:**
- @keyframes swipe-left / swipe-right
- .animate-swipe-left / .animate-swipe-right

**Keyboard Handling:**
- --keyboard-height CSS variable (set by useKeyboardHeight)
- --keyboard-visible (0 or 1)

**Spring Timing Functions:**
- --spring-bounce: cubic-bezier(0.34, 1.56, 0.64, 1)
- --spring-smooth: cubic-bezier(0.25, 0.1, 0.25, 1)
- --spring-snappy: cubic-bezier(0.4, 0, 0.2, 1)

### Test Coverage

| Category | Count | Tests |
|----------|-------|-------|
| Component Tests | 9 | Auth, Editor, HeaderShell, ChapteredLibrary, ShareModal, TagModal, TagBadge, ErrorBoundary, InstallPrompt |
| Utility Tests | 5 | formatTime, sanitize, temporalGrouping, exportImport, withRetry |
| Service Tests | 3 | notes, tags, syncEngine |
| Hook Tests | 3 | useNetworkStatus, useInstallPrompt, useShareTarget |
| E2E Tests | 6 | auth, notes, tags, sharing, export-import, settings |

### Notable Changes Since v2.3.1

**v2.7.0 (2026-01-17):** Mobile Polish Improvements (PR #74)
- BottomSheet component with iOS-style spring animations
- GestureHint one-time swipe tutorial overlay
- useKeyboardHeight hook for Visual Viewport API
- Touch press CSS states for tactile feedback
- SettingsModal refactored to use BottomSheet on mobile
- iOS install guide detects non-Safari browsers

**v2.6.x (2026-01-15):** Mobile Optimizations
- Automatic condensed cards on mobile
- Mobile Sign In link visible without scrolling

**v2.5.x (2026-01-12-13):** Landing Page and Stability
- Landing page redesign with trust signals
- OAuth-first auth layout
- User-controlled reload prompt

**v2.4.0 (2026-01-11):** Session and Shortcuts
- 30-minute session timeout with warning
- Keyboard shortcuts modal (press ?)
- Full account backup export

---

## Snapshot: 2026-01-10 (v2.3.1)

**Commit:** f1f303d
**Release:** PWA Native Feel + Codex Review Fixes

- SwipeableNoteCard, PullToRefresh, IOSInstallGuide components
- Apple splash screens for all iOS devices
- ~28,872 lines of code, 42 components, 9 hooks

---

## Snapshot: 2026-01-07 (v2.0.0)

**Commit:** 0c34982
**Release:** Offline Editing

- IndexedDB with Dexie.js, sync queue, conflict detection
- ~26,335 lines of code, 32 components

---

## Snapshot: 2025-12-28 (v1.9.x)

**Commit:** ad6905b

- Smart chunk loading, shared notes RLS fix
- ~20,178 lines of code, 34 components

---

*End of snapshot timeline*
