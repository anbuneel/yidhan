# Mobile Capability Spectrum

**Version:** 1.0
**Last Updated:** 2026-01-10
**Status:** Living Document
**Author:** Claude (Opus 4.5)

---

## Overview

This document visualizes the progressive mobile capabilities available to Zenote, from basic responsive web to full native iOS/Android apps. Each tier builds on the previous, with clear trade-offs between effort, capability, and user experience.

---

## The Mobile Capability Spectrum

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           MOBILE CAPABILITY SPECTRUM                                     │
│                                                                                         │
│  ◀── Less Effort                                                    More Effort ──▶     │
│  ◀── Less Native Feel                                          More Native Feel ──▶     │
│                                                                                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│   TIER 1          TIER 2          TIER 3          TIER 4          TIER 5               │
│   ───────         ───────         ───────         ───────         ───────              │
│   Responsive      Basic PWA       Enhanced PWA    Capacitor       Native               │
│   Web             (Current)       (Target)        Wrapper         Swift/Kotlin         │
│                                                                                         │
│      │               │               │               │               │                  │
│      │               │               │               │               │                  │
│      ▼               ▼               ▼               ▼               ▼                  │
│                                                                                         │
│   ┌─────┐        ┌─────┐        ┌─────┐        ┌─────┐        ┌─────┐                 │
│   │     │        │ ◐   │        │ ◕   │        │ ●   │        │ ★   │                 │
│   │  ○  │        │     │        │     │        │     │        │     │                 │
│   │     │        │     │        │     │        │     │        │     │                 │
│   └─────┘        └─────┘        └─────┘        └─────┘        └─────┘                 │
│                                                                                         │
│   40%             60%             80%             90%             100%                  │
│   Native          Native          Native          Native          Native               │
│   Feel            Feel            Feel            Feel            Feel                 │
│                                                                                         │
│   ════════════════════════════════════════════════════════════════════════════════     │
│                      ▲                   ▲               ▲                              │
│                      │                   │               │                              │
│               ZENOTE IS            PWA-ONLY        WITH macOS                          │
│               HERE NOW             TARGET          TARGET                               │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Tier-by-Tier Breakdown

### Tier 1: Responsive Web (Baseline)

**What it is:** A website that adapts to screen sizes but has no mobile-specific features.

**Native Feel:** 40%

```
┌────────────────────────────────────────────────────────────────┐
│  TIER 1: RESPONSIVE WEB                                        │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ✅ INCLUDED                        ❌ MISSING                 │
│  ─────────────────                  ─────────────────          │
│  • Flexible layouts                 • Offline support          │
│  • Touch-friendly buttons           • Home screen icon         │
│  • Mobile breakpoints               • Full-screen mode         │
│  • Viewport meta tag                • Background sync          │
│  • Readable typography              • Native gestures          │
│                                     • System integration       │
│                                     • Push notifications       │
│                                                                │
│  EFFORT: None beyond basic CSS                                 │
│  REQUIREMENTS: None                                            │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

### Tier 2: Basic PWA (Zenote's Current State)

**What it is:** Installable web app with offline support and basic native features.

**Native Feel:** 60%

```
┌────────────────────────────────────────────────────────────────┐
│  TIER 2: BASIC PWA  ◀── ZENOTE IS HERE                        │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ✅ INCLUDED                        ❌ STILL MISSING           │
│  ─────────────────                  ─────────────────          │
│  • Everything from Tier 1           • Swipe gestures           │
│  • Service worker                   • Pull-to-refresh          │
│  • Offline app shell                • iOS install guide        │
│  • IndexedDB storage                • Spring animations        │
│  • Install prompt (Android)         • Keyboard handling        │
│  • Home screen icon                 • Native haptics           │
│  • Full-screen mode                 • Widgets                  │
│  • Share Target (Android)           • Siri/Shortcuts           │
│  • View Transitions                 • App Store presence       │
│  • Sync queue                                                  │
│  • Conflict resolution                                         │
│                                                                │
│  EFFORT: ✅ Already implemented                                │
│  REQUIREMENTS: None                                            │
│                                                                │
│  ZENOTE STATUS:                                                │
│  ├── Offline editing ✅                                        │
│  ├── Sync queue ✅                                             │
│  ├── Install prompt (Android) ✅                               │
│  ├── Share Target ✅                                           │
│  ├── View Transitions ✅                                       │
│  └── Safe area handling ✅                                     │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

### Tier 3: Enhanced PWA (PWA-Only Target)

**What it is:** PWA with gesture vocabulary, polished animations, and iOS-specific optimizations.

**Native Feel:** 75-80%

**Requirements:** No macOS needed - pure web technologies

```
┌────────────────────────────────────────────────────────────────┐
│  TIER 3: ENHANCED PWA  ◀── PWA-ONLY TARGET                    │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ✅ ADDS TO TIER 2                  ❌ STILL MISSING           │
│  ─────────────────                  ─────────────────          │
│  • Swipe-to-delete                  • App Store presence       │
│  • Swipe-to-pin                     • Home screen widgets      │
│  • Pull-to-refresh                  • Siri Shortcuts           │
│  • iOS install tutorial             • Share Extension (iOS)    │
│  • Apple splash screens             • Spotlight indexing       │
│  • Spring animations                • True native haptics      │
│  • Card entrance stagger            • Background app refresh   │
│  • Keyboard height handling         • Push notifications*      │
│  • Long-press context menu                                     │
│  • Edge gesture handling            *iOS 16.4+ supports but    │
│  • Overscroll behavior               complex setup             │
│  • Standalone mode detection                                   │
│                                                                │
│  EFFORT: ~5 weeks                                              │
│  REQUIREMENTS: None (web technologies only)                    │
│                                                                │
│  IMPLEMENTATION PLAN:                                          │
│  └── docs/plans/pwa-native-feel-plan.md                       │
│                                                                │
│  TECHNOLOGIES:                                                 │
│  ├── @use-gesture/react (swipe gestures)                      │
│  ├── @react-spring/web (animations)                           │
│  ├── visualViewport API (keyboard)                            │
│  └── CSS springs, View Transitions                            │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**Tier 3 Feature Detail:**

| Feature | Native Feel Contribution | Effort |
|---------|--------------------------|--------|
| Swipe gestures | +15% | 12 hours |
| Pull-to-refresh | +5% | 8 hours |
| iOS install guide | +5% | 6 hours |
| Spring animations | +3% | 4 hours |
| Keyboard handling | +5% | 4 hours |
| Polish & testing | +2% | 8 hours |

---

### Tier 4: Capacitor Wrapper (macOS Target)

**What it is:** PWA wrapped in native container for App Store distribution + native plugins.

**Native Feel:** 85-90%

**Requirements:** macOS with Xcode (or CI with macOS runner)

```
┌────────────────────────────────────────────────────────────────┐
│  TIER 4: CAPACITOR WRAPPER  ◀── macOS TARGET                  │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ✅ ADDS TO TIER 3                  ❌ STILL MISSING           │
│  ─────────────────                  ─────────────────          │
│  • iOS App Store presence           • Native UI components     │
│  • Android Play Store               • Platform-specific UX     │
│  • Native haptics (full)            • Metal/GPU acceleration   │
│  • Status bar theming               • Advanced file access     │
│  • Native splash screen             • Full background modes    │
│  • Home screen widgets*             • Native text rendering    │
│  • Siri Shortcuts*                                             │
│  • Share Extension*                 *Requires Swift code       │
│  • Spotlight indexing*               in addition to Capacitor  │
│  • Push notifications                                          │
│  • TestFlight beta testing                                     │
│  • App review/ratings                                          │
│                                                                │
│  EFFORT: ~9-13 weeks (includes Tier 3)                        │
│  REQUIREMENTS:                                                 │
│  ├── macOS with Xcode 15+                                     │
│  ├── Apple Developer Account ($99/year)                       │
│  └── Google Play Developer ($25 one-time)                     │
│                                                                │
│  IMPLEMENTATION PLAN:                                          │
│  └── docs/plans/mobile-ios-overhaul-plan.md                   │
│                                                                │
│  TECHNOLOGIES:                                                 │
│  ├── @capacitor/ios, @capacitor/android                       │
│  ├── @capacitor/haptics, @capacitor/status-bar                │
│  ├── @capacitor/keyboard, @capacitor/splash-screen            │
│  └── Native Swift (for widgets, shortcuts, share extension)   │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**Tier 4 Additional Features:**

| Feature | Native Feel Contribution | Effort | Requires |
|---------|--------------------------|--------|----------|
| App Store presence | +3% (trust/discoverability) | 8 hours | macOS |
| Native haptics | +2% | 2 hours | Capacitor |
| Status bar theming | +2% | 1 hour | Capacitor |
| Home screen widget | +3% | 16 hours | Swift |
| Siri Shortcuts | +2% | 8 hours | Swift |
| Share Extension | +3% | 24 hours | Swift |

---

### Tier 5: Full Native (Not Recommended)

**What it is:** Separate iOS (Swift) and Android (Kotlin) apps with platform-specific UI.

**Native Feel:** 100%

**Requirements:** Dedicated mobile development team

```
┌────────────────────────────────────────────────────────────────┐
│  TIER 5: FULL NATIVE  ◀── NOT RECOMMENDED FOR ZENOTE          │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ✅ MAXIMUM CAPABILITY              ❌ MASSIVE TRADE-OFFS      │
│  ─────────────────                  ─────────────────          │
│  • Platform-native UI               • 3 separate codebases     │
│  • Best possible performance        • 3x development effort    │
│  • Full system integration          • 3x maintenance burden    │
│  • Platform-specific features       • Feature parity challenge │
│  • Native text rendering            • Requires Swift + Kotlin  │
│  • Full gesture system              • $99 + $25 annual fees    │
│  • All OS capabilities              • Unsustainable solo       │
│                                                                │
│  EFFORT: 6-12 months initial, ongoing maintenance             │
│  REQUIREMENTS:                                                 │
│  ├── macOS with Xcode                                         │
│  ├── Swift expertise                                          │
│  ├── Kotlin/Android expertise                                 │
│  ├── Dedicated mobile team                                    │
│  └── Significant ongoing investment                           │
│                                                                │
│  WHY NOT FOR ZENOTE:                                          │
│  ├── Note-taking doesn't need native performance              │
│  ├── Wabi-sabi philosophy = simplicity over complexity        │
│  ├── Solo developer can't maintain 3 codebases                │
│  └── Capacitor provides 90% of benefits at 20% effort         │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## Visual Comparison: Features by Tier

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        FEATURE AVAILABILITY BY TIER                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  FEATURE                    │ T1  │ T2  │ T3  │ T4  │ T5  │                    │
│  ──────────────────────────│─────│─────│─────│─────│─────│                    │
│  Responsive layout          │ ✅  │ ✅  │ ✅  │ ✅  │ ✅  │                    │
│  Touch-friendly UI          │ ✅  │ ✅  │ ✅  │ ✅  │ ✅  │                    │
│  ──────────────────────────│─────│─────│─────│─────│─────│                    │
│  Offline support            │ ❌  │ ✅  │ ✅  │ ✅  │ ✅  │                    │
│  Home screen install        │ ❌  │ ✅  │ ✅  │ ✅  │ ✅  │                    │
│  Full-screen mode           │ ❌  │ ✅  │ ✅  │ ✅  │ ✅  │                    │
│  Share Target (Android)     │ ❌  │ ✅  │ ✅  │ ✅  │ ✅  │                    │
│  ──────────────────────────│─────│─────│─────│─────│─────│                    │
│  Swipe gestures             │ ❌  │ ❌  │ ✅  │ ✅  │ ✅  │                    │
│  Pull-to-refresh            │ ❌  │ ❌  │ ✅  │ ✅  │ ✅  │                    │
│  iOS install guide          │ ❌  │ ❌  │ ✅  │ ✅  │ ✅  │                    │
│  Spring animations          │ ❌  │ ❌  │ ✅  │ ✅  │ ✅  │                    │
│  Keyboard handling          │ ❌  │ ❌  │ ✅  │ ✅  │ ✅  │                    │
│  ──────────────────────────│─────│─────│─────│─────│─────│                    │
│  App Store presence         │ ❌  │ ❌  │ ❌  │ ✅  │ ✅  │  ← Requires macOS  │
│  Native haptics (full)      │ ❌  │ ❌  │ ⚠️  │ ✅  │ ✅  │  ← Requires macOS  │
│  Status bar theming         │ ❌  │ ❌  │ ❌  │ ✅  │ ✅  │  ← Requires macOS  │
│  Push notifications         │ ❌  │ ❌  │ ⚠️  │ ✅  │ ✅  │  ← Requires macOS  │
│  ──────────────────────────│─────│─────│─────│─────│─────│                    │
│  Home screen widgets        │ ❌  │ ❌  │ ❌  │ ⚠️  │ ✅  │  ← Requires Swift  │
│  Siri Shortcuts             │ ❌  │ ❌  │ ❌  │ ⚠️  │ ✅  │  ← Requires Swift  │
│  Share Extension (iOS)      │ ❌  │ ❌  │ ❌  │ ⚠️  │ ✅  │  ← Requires Swift  │
│  Spotlight indexing         │ ❌  │ ❌  │ ❌  │ ⚠️  │ ✅  │  ← Requires Swift  │
│  ──────────────────────────│─────│─────│─────│─────│─────│                    │
│  Native UI components       │ ❌  │ ❌  │ ❌  │ ❌  │ ✅  │  ← Full native     │
│  Platform-specific UX       │ ❌  │ ❌  │ ❌  │ ❌  │ ✅  │  ← Full native     │
│                                                                                 │
│  LEGEND: ✅ Full support  ⚠️ Partial/requires extra  ❌ Not available          │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Effort vs. Native Feel Chart

```
Native Feel
    │
100%│                                               ┌─────────┐
    │                                               │  T5     │
 90%│                               ┌───────────────┤ Native  │
    │                               │               └─────────┘
 80%│               ┌───────────────┤   T4
    │               │               │ Capacitor
 70%│               │   T3          └───────────────────────────
    │       ┌───────┤ Enhanced
 60%│       │       │ PWA
    │   T2  │       └───────────────────────────────────────────
 50%│ Basic │
    │ PWA   │
 40%│───────┴─────────────────────────────────────────────────────
    │ T1
    │ Responsive
    └─────────────────────────────────────────────────────────────▶
         1 wk    5 wk    10 wk    15 wk    6 mo    12 mo
                              EFFORT

    ══════════════════════════════════════════════════════════════
    │         │                   │                │
    │   NOW   │    PWA Target     │  macOS Target  │
    │   (T2)  │       (T3)        │     (T4)       │
    ══════════════════════════════════════════════════════════════
```

---

## Decision Matrix: Which Tier to Target?

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           DECISION FLOWCHART                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│                          START                                                  │
│                            │                                                    │
│                            ▼                                                    │
│              ┌─────────────────────────────┐                                   │
│              │  Do you have macOS access?  │                                   │
│              └─────────────────────────────┘                                   │
│                     │              │                                           │
│                    YES            NO                                           │
│                     │              │                                           │
│                     ▼              ▼                                           │
│    ┌─────────────────────┐  ┌─────────────────────┐                           │
│    │ Do you need App     │  │ Target: TIER 3      │                           │
│    │ Store presence?     │  │ Enhanced PWA        │                           │
│    └─────────────────────┘  │ (5 weeks)           │                           │
│           │          │      └─────────────────────┘                           │
│          YES        NO                                                         │
│           │          │                                                         │
│           ▼          ▼                                                         │
│    ┌────────────┐  ┌────────────┐                                             │
│    │ Do you     │  │ Target:    │                                             │
│    │ need       │  │ TIER 3     │                                             │
│    │ widgets/   │  │ Enhanced   │                                             │
│    │ Siri?      │  │ PWA        │                                             │
│    └────────────┘  └────────────┘                                             │
│       │      │                                                                 │
│      YES    NO                                                                 │
│       │      │                                                                 │
│       ▼      ▼                                                                 │
│  ┌──────────────┐  ┌──────────────┐                                           │
│  │ Target:      │  │ Target:      │                                           │
│  │ TIER 4+Swift │  │ TIER 4       │                                           │
│  │ (13+ weeks)  │  │ (9-10 weeks) │                                           │
│  └──────────────┘  └──────────────┘                                           │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Zenote's Recommended Path

### Path A: No macOS (Current Reality)

```
NOW ────────▶ TIER 3 ────────▶ FUTURE (if macOS acquired)
 │               │                      │
 │               │                      ▼
 T2: Basic PWA   T3: Enhanced PWA      T4: Capacitor
 60% native      80% native            90% native
 ✅ Complete     5 weeks               +8 weeks
```

### Path B: With macOS (Future Possibility)

```
NOW ────────▶ TIER 3 ────────▶ TIER 4 ────────▶ TIER 4+
 │               │                │                │
 T2: Basic PWA   T3: Enhanced     T4: Capacitor   T4+: Swift
 60% native      80% native       90% native      95% native
 ✅ Complete     5 weeks          +4 weeks        +4 weeks
```

---

## Cost Analysis by Tier

| Tier | Development | Annual Costs | Total Year 1 |
|------|-------------|--------------|--------------|
| **Tier 1** | 0 | $0 | $0 |
| **Tier 2** | ✅ Done | $0 | $0 |
| **Tier 3** | 5 weeks | $0 | $0 |
| **Tier 4** | +4 weeks | $124 (Apple + Google) | $124 |
| **Tier 4+ (widgets)** | +4 weeks | $124 | $124 |
| **Tier 5** | 6-12 months | $124 + team salaries | $$$$ |

---

## User Experience by Tier

### iOS User Journey

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                     iOS USER EXPERIENCE BY TIER                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  TIER 2 (Current):                                                             │
│  ─────────────────                                                             │
│  User: "How do I install this?"                                                │
│  App: *Shows in Safari, user confused*                                         │
│  User: "It works offline! But feels... webby."                                 │
│                                                                                 │
│  TIER 3 (PWA Target):                                                          │
│  ────────────────────                                                          │
│  User: "Oh, there's a guide to install!"                                       │
│  App: *Step-by-step Safari instructions*                                       │
│  User: "Swipe to delete! This feels like a real app!"                          │
│  User: "Pull to refresh, nice animations... very smooth."                      │
│                                                                                 │
│  TIER 4 (Capacitor):                                                           │
│  ─────────────────                                                             │
│  User: "Found it in the App Store!"                                            │
│  App: *Native install, proper icon*                                            │
│  User: "The haptics feel great. Status bar matches the theme."                 │
│  User: "Siri, create a new Zenote!" → Works                                    │
│                                                                                 │
│  TIER 5 (Native):                                                              │
│  ─────────────────                                                             │
│  User: "This is indistinguishable from Apple Notes."                           │
│  Developer: *Maintaining 3 codebases, crying*                                  │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Summary: Both Plans Are Valid

| Plan | Target Tier | Requirements | Timeline | Native Feel |
|------|-------------|--------------|----------|-------------|
| **PWA-Only Plan** | Tier 3 | None | 5 weeks | 75-80% |
| **Full Mobile Plan** | Tier 4+ | macOS + $124/yr | 13 weeks | 90-95% |

**Recommendation:**
1. Implement **Tier 3 (PWA-Only)** now - it requires no special hardware
2. When/if macOS becomes available, continue to **Tier 4** - the PWA work transfers directly

Both plans share the same Phase 1-3. The macOS plan just adds Phases 4-5 (system integration + App Store).

---

## Related Documents

- [pwa-native-feel-plan.md](../plans/pwa-native-feel-plan.md) - Tier 3 implementation (no macOS)
- [mobile-ios-overhaul-plan.md](../plans/mobile-ios-overhaul-plan.md) - Tier 4 implementation (with macOS)
- [ios-native-competitive-analysis-claude.md](ios-native-competitive-analysis-claude.md) - Competitive analysis
- [mobile-ios-gap-analysis-claude.md](mobile-ios-gap-analysis-claude.md) - Gap inventory

---

*This spectrum helps visualize where Zenote is, where it can go, and what's required at each step.*
