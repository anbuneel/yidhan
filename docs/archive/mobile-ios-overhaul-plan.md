# Mobile & iOS Comprehensive Overhaul Plan

**Version:** 1.0
**Last Updated:** 2026-01-10
**Status:** Ready to Implement
**Author:** Claude (Opus 4.5)

---

## Overview

This plan details the implementation of a comprehensive mobile overhaul for Zenote, targeting both PWA (Safari/Chrome) and App Store (Capacitor) distribution. The goal is achieving **90% native iOS feel** without building a full Swift app.

### Objectives

1. **PWA Excellence:** Best-in-class iOS Safari PWA experience
2. **Native App Store Presence:** iOS App Store via Capacitor
3. **Gesture-Rich Interaction:** Swipe actions, pull-to-refresh, haptics
4. **System Integration:** Widgets, Shortcuts, Share Extension
5. **Performance Parity:** 60fps animations, instant response

### Timeline Summary

| Phase | Duration | Focus |
|-------|----------|-------|
| Phase 1 | 1-2 weeks | Quick Wins + Capacitor Setup |
| Phase 2 | 2-3 weeks | Core Gestures |
| Phase 3 | 1-2 weeks | Animations & Polish |
| Phase 4 | 3-4 weeks | System Integration |
| Phase 5 | 2 weeks | Testing & Launch |
| **Total** | **9-13 weeks** | **Complete Mobile Overhaul** |

---

## Phase 1: Quick Wins & Foundation (1-2 weeks)

**Goal:** Immediate improvements + Capacitor iOS setup

### 1.1 iOS Safari Install Tutorial

**Priority:** Critical | **Effort:** 4 hours

**Files to modify:**
- `src/hooks/useInstallPrompt.ts` - Add iOS detection
- `src/components/InstallPrompt.tsx` - iOS tutorial UI
- Add new component: `src/components/IOSInstallGuide.tsx`

**Implementation:**

```typescript
// useInstallPrompt.ts additions
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome|CriOS/.test(navigator.userAgent);
const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches;
const showIOSGuide = isIOS && isSafari && !isInStandaloneMode && !isDismissed;

return {
  // ... existing
  isIOS,
  showIOSGuide,
};
```

**IOSInstallGuide.tsx Features:**
- Visual step-by-step (Share icon → Add to Home Screen)
- Animated illustrations
- "Don't show again" option
- Zen-styled to match app aesthetic

**Acceptance Criteria:**
- [ ] Detects iOS Safari correctly
- [ ] Shows tutorial only for non-installed users
- [ ] Respects dismissal
- [ ] Matches Zenote's visual style

---

### 1.2 Capacitor iOS Setup

**Priority:** Critical | **Effort:** 4-6 hours

**Prerequisites:**
- macOS with Xcode 15+ (or CI with macOS runner)
- Apple Developer account (free for testing, $99/yr for App Store)

**Commands:**

```bash
# Install iOS platform
npm install @capacitor/ios
npx cap add ios

# Install essential plugins
npm install @capacitor/status-bar @capacitor/haptics @capacitor/keyboard @capacitor/splash-screen

# Build and sync
npm run build
npx cap sync ios

# Open in Xcode
npx cap open ios
```

**Configuration (capacitor.config.ts):**

```typescript
const config: CapacitorConfig = {
  appId: 'com.zenote.app',
  appName: 'Zenote',
  webDir: 'dist',
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    backgroundColor: '#1a1f1a',
  },
  android: {
    backgroundColor: '#1a1f1a',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#1a1f1a',
      showSpinner: false,
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#1a1f1a',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
};
```

**package.json scripts:**

```json
{
  "scripts": {
    "cap:ios": "npm run build && npx cap sync ios && npx cap open ios",
    "cap:ios:run": "npm run build && npx cap sync ios && npx cap run ios"
  }
}
```

**Acceptance Criteria:**
- [ ] `ios/` folder created successfully
- [ ] App runs in iOS Simulator
- [ ] App runs on physical iPhone (via Xcode)
- [ ] All existing features work in Capacitor shell

---

### 1.3 Status Bar Theming

**Priority:** High | **Effort:** 2 hours

**Files to modify:**
- `src/App.tsx` or new `src/utils/native.ts`

**Implementation:**

```typescript
// src/utils/native.ts
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

export async function initNativeFeatures(theme: 'light' | 'dark') {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await StatusBar.setStyle({
      style: theme === 'dark' ? Style.Dark : Style.Light,
    });
    await StatusBar.setBackgroundColor({
      color: theme === 'dark' ? '#1a1f1a' : '#f5f0e8',
    });
  } catch (error) {
    console.warn('StatusBar not available:', error);
  }
}
```

**Usage in App.tsx:**

```typescript
useEffect(() => {
  initNativeFeatures(theme);
}, [theme]);
```

---

### 1.4 Native Haptics

**Priority:** High | **Effort:** 3 hours

**Files to modify:**
- `src/utils/native.ts` - Add haptic helper
- Multiple components - Replace `navigator.vibrate()`

**Implementation:**

```typescript
// src/utils/native.ts
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export async function haptic(type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' = 'light') {
  if (!Capacitor.isNativePlatform()) {
    // Fallback for web
    if ('vibrate' in navigator) {
      navigator.vibrate(type === 'heavy' ? 30 : type === 'medium' ? 20 : 10);
    }
    return;
  }

  try {
    if (type === 'success' || type === 'warning' || type === 'error') {
      const notifType = {
        success: NotificationType.Success,
        warning: NotificationType.Warning,
        error: NotificationType.Error,
      }[type];
      await Haptics.notification({ type: notifType });
    } else {
      const impactStyle = {
        light: ImpactStyle.Light,
        medium: ImpactStyle.Medium,
        heavy: ImpactStyle.Heavy,
      }[type];
      await Haptics.impact({ style: impactStyle });
    }
  } catch (error) {
    // Haptics not available
  }
}
```

**Components to update:**
- `TimeRibbon.tsx` - Chapter selection
- `NoteCard.tsx` - Pin button, delete button
- `Editor.tsx` - Save confirmation
- `TagSelector.tsx` - Tag selection
- Future: Swipe actions

---

### 1.5 Apple Splash Screens

**Priority:** Medium | **Effort:** 3 hours

**Files to create:**
- `public/splash/*.png` - Multiple sizes
- Update `index.html`

**index.html additions:**

```html
<!-- iPhone SE, 8, 7, 6s, 6 -->
<link rel="apple-touch-startup-image" href="/splash/splash-750x1334.png"
      media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)">

<!-- iPhone 14, 13, 12 -->
<link rel="apple-touch-startup-image" href="/splash/splash-1170x2532.png"
      media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)">

<!-- iPhone 14 Pro Max, 13 Pro Max, 12 Pro Max -->
<link rel="apple-touch-startup-image" href="/splash/splash-1290x2796.png"
      media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)">

<!-- iPhone SE (3rd gen), 8 Plus, 7 Plus, 6s Plus -->
<link rel="apple-touch-startup-image" href="/splash/splash-1242x2208.png"
      media="(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3)">
```

**Splash Design:**
- Dark background (#1a1f1a)
- Centered Zenote icon
- Subtle gold accent glow

---

### 1.6 Spring Animation Timing

**Priority:** Low | **Effort:** 2 hours

**Files to modify:**
- `src/index.css` - Add CSS variable for spring timing

**Implementation:**

```css
/* index.css */
:root {
  /* iOS-like spring timing functions */
  --spring-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
  --spring-smooth: cubic-bezier(0.25, 0.1, 0.25, 1);
  --spring-snappy: cubic-bezier(0.4, 0, 0.2, 1);
}

/* Apply to existing transitions */
.note-card {
  transition: transform 0.4s var(--spring-bounce),
              box-shadow 0.3s var(--spring-smooth);
}

.note-card:hover,
.note-card:active {
  transform: translateY(-4px);
}
```

---

### Phase 1 Checklist

- [ ] iOS Safari install tutorial
- [ ] iOS Capacitor setup
- [ ] Status bar theming
- [ ] Native haptics utility
- [ ] Apple splash screens
- [ ] Spring animation timing
- [ ] Test on iOS Simulator
- [ ] Test on physical iPhone

**Phase 1 Deliverable:** iOS Capacitor build running with polished PWA fallback.

---

## Phase 2: Core Gestures (2-3 weeks)

**Goal:** Implement gesture patterns that define native iOS feel

### 2.1 Swipe-to-Delete

**Priority:** Critical | **Effort:** 8 hours

**Dependencies:**
- Install `@use-gesture/react` (or implement custom)

**Files to modify/create:**
- `src/components/NoteCard.tsx` - Add swipe handling
- `src/components/SwipeableCard.tsx` - New wrapper component
- `src/index.css` - Swipe action styles

**Implementation Approach:**

```typescript
// SwipeableCard.tsx
import { useDrag } from '@use-gesture/react';
import { animated, useSpring } from '@react-spring/web';

interface SwipeableCardProps {
  children: React.ReactNode;
  onSwipeLeft: () => void;  // Delete
  onSwipeRight: () => void; // Pin
}

export function SwipeableCard({ children, onSwipeLeft, onSwipeRight }: SwipeableCardProps) {
  const THRESHOLD = 80;
  const FULL_SWIPE = 150;

  const [{ x }, api] = useSpring(() => ({ x: 0 }));
  const [showLeftAction, setShowLeftAction] = useState(false);
  const [showRightAction, setShowRightAction] = useState(false);

  const bind = useDrag(
    ({ movement: [mx], velocity: [vx], direction: [dx], down, cancel }) => {
      // Left swipe (delete)
      if (mx < -THRESHOLD) {
        setShowLeftAction(true);
        if (!down && (mx < -FULL_SWIPE || vx > 1.5)) {
          haptic('medium');
          onSwipeLeft();
          cancel();
        }
      } else {
        setShowLeftAction(false);
      }

      // Right swipe (pin)
      if (mx > THRESHOLD) {
        setShowRightAction(true);
        if (!down && (mx > FULL_SWIPE || vx > 1.5)) {
          haptic('light');
          onSwipeRight();
          cancel();
        }
      } else {
        setShowRightAction(false);
      }

      // Animate
      api.start({
        x: down ? mx : 0,
        immediate: down,
        config: { tension: 300, friction: 30 },
      });
    },
    { axis: 'x', filterTaps: true }
  );

  return (
    <div className="swipeable-card-container">
      {/* Left action (delete) */}
      <div className={`swipe-action-left ${showLeftAction ? 'visible' : ''}`}>
        <span className="action-icon">🗑️</span>
        <span className="action-label">Delete</span>
      </div>

      {/* Right action (pin) */}
      <div className={`swipe-action-right ${showRightAction ? 'visible' : ''}`}>
        <span className="action-icon">📌</span>
        <span className="action-label">Pin</span>
      </div>

      {/* Card content */}
      <animated.div {...bind()} style={{ x }} className="swipeable-card-content">
        {children}
      </animated.div>
    </div>
  );
}
```

**CSS:**

```css
.swipeable-card-container {
  position: relative;
  overflow: hidden;
}

.swipe-action-left,
.swipe-action-right {
  position: absolute;
  top: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0 1.5rem;
  opacity: 0;
  transition: opacity 0.15s;
}

.swipe-action-left {
  right: 0;
  background: var(--color-error);
  color: white;
}

.swipe-action-right {
  left: 0;
  background: var(--color-accent);
  color: white;
}

.swipe-action-left.visible,
.swipe-action-right.visible {
  opacity: 1;
}

.swipeable-card-content {
  position: relative;
  z-index: 1;
  background: var(--color-card-bg);
  touch-action: pan-y;
}
```

**Acceptance Criteria:**
- [ ] Swipe left reveals delete action
- [ ] Swipe right reveals pin action
- [ ] Full swipe auto-triggers action
- [ ] Haptic feedback at threshold
- [ ] Springs back on release
- [ ] Works on both iOS and Android
- [ ] Desktop mouse drag works too

---

### 2.2 Pull-to-Refresh

**Priority:** High | **Effort:** 8 hours

**Files to modify/create:**
- `src/components/PullToRefresh.tsx` - New component
- `src/components/ChapteredLibrary.tsx` - Wrap with PTR
- `src/index.css` - PTR styles

**Implementation:**

```typescript
// PullToRefresh.tsx
interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);

  const THRESHOLD = 80;

  const handleTouchStart = (e: TouchEvent) => {
    if (window.scrollY === 0) {
      setPulling(true);
      // Track start position
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!pulling) return;
    const distance = /* calculate distance */;
    setPullDistance(Math.min(distance, THRESHOLD * 1.5));

    if (distance >= THRESHOLD) {
      haptic('light');
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance >= THRESHOLD) {
      setRefreshing(true);
      haptic('success');
      await onRefresh();
      setRefreshing(false);
    }
    setPulling(false);
    setPullDistance(0);
  };

  return (
    <div className="ptr-container">
      <div
        className={`ptr-indicator ${refreshing ? 'refreshing' : ''}`}
        style={{ transform: `translateY(${pullDistance - 60}px)` }}
      >
        {refreshing ? (
          <div className="ptr-spinner" />
        ) : (
          <div className="ptr-arrow" style={{ rotate: `${pullDistance * 2}deg` }} />
        )}
      </div>
      <div
        className="ptr-content"
        style={{ transform: `translateY(${pullDistance}px)` }}
      >
        {children}
      </div>
    </div>
  );
}
```

**Integration in ChapteredLibrary:**

```typescript
<PullToRefresh onRefresh={handleManualSync}>
  {/* existing library content */}
</PullToRefresh>
```

---

### 2.3 Keyboard Handling

**Priority:** High | **Effort:** 8 hours

**Files to modify:**
- `src/hooks/useKeyboardHeight.ts` - New hook
- `src/components/EditorToolbar.tsx` - Keyboard-aware positioning
- `src/index.css` - CSS variables

**Implementation:**

```typescript
// useKeyboardHeight.ts
export function useKeyboardHeight() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    if (!window.visualViewport) return;

    let timeoutId: number;

    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        const viewport = window.visualViewport!;
        const height = window.innerHeight - viewport.height;

        setKeyboardHeight(height);
        setIsKeyboardOpen(height > 100);

        document.documentElement.style.setProperty(
          '--keyboard-height',
          `${height}px`
        );
      }, 50);
    };

    window.visualViewport.addEventListener('resize', handleResize);
    window.visualViewport.addEventListener('scroll', handleResize);

    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('scroll', handleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  return { keyboardHeight, isKeyboardOpen };
}
```

**EditorToolbar adjustment:**

```css
.editor-toolbar {
  position: sticky;
  bottom: calc(var(--keyboard-height, 0px) + env(safe-area-inset-bottom));
  transition: bottom 0.15s ease-out;
}
```

---

### 2.4 Long-Press Context Menu

**Priority:** Medium | **Effort:** 4 hours

**Implementation:** Use native `contextmenu` event or custom long-press detection.

```typescript
// NoteCard long-press menu
const [showMenu, setShowMenu] = useState(false);
const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });

const handleContextMenu = (e: React.MouseEvent | React.TouchEvent) => {
  e.preventDefault();
  const { clientX, clientY } = 'touches' in e ? e.touches[0] : e;
  setMenuPosition({ x: clientX, y: clientY });
  setShowMenu(true);
  haptic('medium');
};

// Menu items: Pin, Delete, Copy, Share
```

---

### 2.5 Edge Gesture Dead Zone

**Priority:** Medium | **Effort:** 2 hours

**Implementation:**

```css
/* Prevent conflict with iOS Safari edge swipe */
.main-content {
  padding-left: max(16px, calc(env(safe-area-inset-left) + 12px));
}

/* Visual indicator for swipe-back area (optional) */
.edge-swipe-indicator {
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  width: 20px;
  background: transparent;
  pointer-events: none;
}

.edge-swipe-indicator.active {
  background: linear-gradient(
    to right,
    rgba(var(--color-accent-rgb), 0.2),
    transparent
  );
}
```

---

### Phase 2 Checklist

- [ ] Swipe-to-delete on NoteCard
- [ ] Swipe-to-pin on NoteCard
- [ ] Pull-to-refresh with sync
- [ ] Keyboard height handling
- [ ] Long-press context menu
- [ ] Edge gesture dead zone
- [ ] Test all gestures on iOS
- [ ] Test all gestures on Android

**Phase 2 Deliverable:** Full gesture vocabulary matching native iOS apps.

---

## Phase 3: Animations & Polish (1-2 weeks)

### 3.1 Card Entrance Stagger

**Effort:** 4 hours

```typescript
// ChapterSection.tsx
{notes.map((note, index) => (
  <motion.div
    key={note.id}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{
      delay: index * 0.05,
      duration: 0.3,
      type: 'spring',
      stiffness: 300,
      damping: 30,
    }}
  >
    <NoteCard note={note} />
  </motion.div>
))}
```

### 3.2 Editor Zoom Transition

**Effort:** 8 hours

Using View Transitions API with custom animation:

```typescript
// Navigate with zoom effect
const openNote = async (noteId: string, cardRect: DOMRect) => {
  document.documentElement.style.setProperty('--card-x', `${cardRect.x}px`);
  document.documentElement.style.setProperty('--card-y', `${cardRect.y}px`);
  document.documentElement.style.setProperty('--card-w', `${cardRect.width}px`);
  document.documentElement.style.setProperty('--card-h', `${cardRect.height}px`);

  await document.startViewTransition(() => {
    setViewMode('editor');
    setCurrentNoteId(noteId);
  }).ready;
};
```

```css
::view-transition-old(editor),
::view-transition-new(editor) {
  animation-duration: 0.4s;
  animation-timing-function: var(--spring-bounce);
}

::view-transition-new(editor) {
  animation-name: zoom-in;
}

@keyframes zoom-in {
  from {
    transform: translate(
      calc(var(--card-x) - 50vw + var(--card-w) / 2),
      calc(var(--card-y) - 50vh + var(--card-h) / 2)
    ) scale(0.5);
    opacity: 0;
  }
  to {
    transform: translate(0, 0) scale(1);
    opacity: 1;
  }
}
```

### 3.3 Pin Glow Effect

**Effort:** 2 hours

```typescript
const handlePin = async () => {
  await haptic('success');

  // Trigger glow animation
  setShowGlow(true);
  setTimeout(() => setShowGlow(false), 600);

  await togglePin(noteId);
};
```

```css
.pin-glow {
  position: absolute;
  inset: -10px;
  border-radius: inherit;
  background: radial-gradient(
    circle,
    rgba(var(--color-accent-rgb), 0.4) 0%,
    transparent 70%
  );
  animation: glow-pulse 0.6s ease-out forwards;
  pointer-events: none;
}

@keyframes glow-pulse {
  0% {
    transform: scale(0.8);
    opacity: 0;
  }
  50% {
    transform: scale(1.2);
    opacity: 1;
  }
  100% {
    transform: scale(1.5);
    opacity: 0;
  }
}
```

### 3.4 Delete Animation

**Effort:** 2 hours

```typescript
// Before actual deletion, animate out
const handleDelete = async () => {
  setIsDeleting(true);
  await haptic('warning');

  // Wait for animation
  await new Promise(resolve => setTimeout(resolve, 300));

  await softDeleteNote(noteId);
};
```

```css
.note-card.deleting {
  animation: delete-out 0.3s ease-out forwards;
}

@keyframes delete-out {
  to {
    transform: scale(0.8) rotate(2deg);
    opacity: 0;
  }
}
```

---

### Phase 3 Checklist

- [ ] Card entrance stagger animation
- [ ] Editor zoom transition (View Transitions)
- [ ] Pin glow effect
- [ ] Delete animation
- [ ] TimeRibbon fade polish
- [ ] Loading skeleton states
- [ ] 60fps validation on all animations

---

## Phase 4: System Integration (3-4 weeks)

### 4.1 Home Screen Widget

**Effort:** 16 hours | **Requires:** Native Swift code

**Steps:**
1. Create Widget Extension in Xcode
2. Set up App Groups for data sharing
3. Implement widget views (small, medium)
4. Share recent notes data via UserDefaults

**Widget Types:**
- **Small:** Quick create note button
- **Medium:** 3 most recent notes

### 4.2 Siri Shortcuts

**Effort:** 8 hours

**Plugin:** `@nicholasleblanc/capacitor-siri-shortcuts`

```typescript
import { SiriShortcuts } from '@nicholasleblanc/capacitor-siri-shortcuts';

// Donate shortcut
await SiriShortcuts.donate({
  persistentIdentifier: 'com.zenote.create',
  title: 'Create Zenote Note',
  suggestedInvocationPhrase: 'New Zenote',
  userInfo: { action: 'create' },
});

// Handle URL scheme
App.addListener('appUrlOpen', ({ url }) => {
  if (url.includes('zenote://create')) {
    navigateToEditor(null);
  }
});
```

### 4.3 Share Extension

**Effort:** 24 hours | **Requires:** Native Swift code

**Steps:**
1. Create Share Extension target in Xcode
2. Configure App Groups
3. Implement share UI
4. Save to shared container
5. Main app reads on launch

### 4.4 Spotlight Indexing

**Effort:** 8 hours

```typescript
// Index notes for Spotlight search
import { CoreSpotlight } from '@nicholasleblanc/capacitor-core-spotlight';

await CoreSpotlight.index({
  items: notes.map(note => ({
    uniqueIdentifier: note.id,
    domainIdentifier: 'com.zenote.notes',
    title: note.title,
    contentDescription: stripHtml(note.content).substring(0, 200),
    thumbnailUri: undefined,
  })),
});
```

---

## Phase 5: Testing & Launch (2 weeks)

### 5.1 Device Testing Matrix

| Device | Tests | Status |
|--------|-------|--------|
| iPhone SE (3rd gen) | All gestures, keyboard, safe areas | [ ] |
| iPhone 14 Pro | Full test suite | [ ] |
| iPhone 15 Pro Max | Large screen, Dynamic Island | [ ] |
| iPad Mini | Tablet layout, multitasking | [ ] |
| Samsung Galaxy S23 | Android gestures, back button | [ ] |
| Pixel 7 | Stock Android | [ ] |

### 5.2 Test Scenarios

**Gestures:**
- [ ] Swipe delete works reliably
- [ ] Swipe pin works reliably
- [ ] Pull-to-refresh triggers sync
- [ ] Long-press shows menu
- [ ] Edge swipe doesn't conflict

**Keyboard:**
- [ ] Toolbar stays above keyboard
- [ ] No layout jump on keyboard open
- [ ] Cursor position preserved

**Offline:**
- [ ] Create note offline → syncs when online
- [ ] Edit note offline → conflict handling works
- [ ] Indicator shows correct status

**Animations:**
- [ ] All animations at 60fps
- [ ] No jank on older devices
- [ ] Reduced motion respected

### 5.3 App Store Submission

**Requirements:**
- [ ] Screenshots (6.7" and 5.5" required)
- [ ] App description
- [ ] Privacy policy URL
- [ ] Age rating questionnaire
- [ ] App icon (1024x1024)
- [ ] TestFlight beta testing

---

## Dependencies & Libraries

### New Dependencies

```json
{
  "dependencies": {
    "@use-gesture/react": "^10.3.0",
    "@react-spring/web": "^9.7.3",
    "@capacitor/ios": "^6.0.0",
    "@capacitor/status-bar": "^6.0.0",
    "@capacitor/haptics": "^6.0.0",
    "@capacitor/keyboard": "^6.0.0",
    "@capacitor/splash-screen": "^6.0.0"
  }
}
```

### Optional (for system integration)

```json
{
  "dependencies": {
    "@nicholasleblanc/capacitor-siri-shortcuts": "^2.0.0",
    "@nicholasleblanc/capacitor-core-spotlight": "^2.0.0"
  }
}
```

---

## Risk Mitigation

| Risk | Probability | Mitigation |
|------|-------------|------------|
| No macOS access | High | GitHub Actions with macOS runner |
| Gesture conflicts with Tiptap | Medium | Thorough testing, adjust thresholds |
| App Store rejection | Low | Follow HIG, no web-only features |
| Performance on older devices | Medium | Profile early, optimize animations |

---

## Success Criteria

### Phase Gates

| Phase | Gate Criteria |
|-------|---------------|
| Phase 1 | iOS Capacitor build runs on physical device |
| Phase 2 | All gestures work on iOS and Android |
| Phase 3 | Animations hit 60fps target |
| Phase 4 | Widget shows recent notes |
| Phase 5 | App Store approval |

### Launch Criteria

- [ ] Mobile Lighthouse score: 100
- [ ] All P0 gaps closed
- [ ] Real device testing on 4+ devices
- [ ] No critical bugs in TestFlight
- [ ] App Store approved

---

## Next Steps

1. **Approve this plan** - Confirm timeline and priorities
2. **Phase 1 kickoff** - Start with iOS install tutorial
3. **macOS access** - Required for iOS Capacitor builds
4. **Device access** - Obtain test devices or BrowserStack subscription

---

*Ready to begin when you give the go-ahead!*
