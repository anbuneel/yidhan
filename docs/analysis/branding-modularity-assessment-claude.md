# Branding Modularity Assessment

**Version:** 1.0
**Last Updated:** 2026-01-12
**Status:** Complete
**Author:** Claude (Opus 4.5)

---

## Original Prompt

> If we need to change the branding again, how easy is it? Are all the brand/logo related items plug and play?

---

## Executive Summary

The codebase has **partial** branding modularity. Visual assets (icons, colors, fonts) are plug-and-play, but the brand name is hardcoded across 128+ files and requires manual updates.

---

## Modularity Assessment

| Component | Plug & Play? | Effort to Change | Location |
|-----------|--------------|------------------|----------|
| **Icons/Favicon** | ✅ Yes | Replace source PNG → run script | `design-assets/`, `scripts/generate-icons.ts` |
| **Colors/Themes** | ✅ Yes | Edit theme files → regenerate | `src/themes/*.ts` |
| **Fonts** | ✅ Yes | Update HTML + CSS variables | `index.html`, `index.css` |
| **Brand Name** | ❌ No | 128 files, manual find/replace | Throughout codebase |
| **localStorage Keys** | ❌ No | Hardcoded prefixes + migration | `src/hooks/`, `src/services/` |
| **IndexedDB Name** | ❌ No | Hardcoded + requires migration | `src/lib/offlineDb.ts` |
| **Package/App IDs** | ❌ No | Multiple config files | `package.json`, `capacitor.config.ts` |

---

## Plug & Play Components

### 1. Icons & Favicon

**How to change:**
```bash
# 1. Replace source logo in design-assets/
cp new-logo.png design-assets/yidhan-logo-primary.png

# 2. Generate all icon sizes
npm run icons:generate
```

**Files generated:**
- `public/icons/icon-512.png` (512×512)
- `public/icons/icon-192.png` (192×192)
- `public/icons/apple-touch-icon.png` (180×180)
- `public/icons/icon-32.png` (32×32)
- `public/icons/icon-16.png` (16×16)
- `public/favicon.png`
- `public/apple-touch-icon.png`

**Script location:** `scripts/generate-icons.ts`

The script automatically:
- Crops the icon portion (arc + dot) from the full logo
- Generates all PWA-required sizes
- Uses warm paper background (#FAF6F1) for consistency

---

### 2. Color Themes

**How to change:**
```bash
# 1. Edit theme files
# src/themes/kintsugi.ts (light)
# src/themes/midnight.ts (dark)

# 2. Preview changes
npm run theme:preview

# 3. Generate CSS
npm run theme:generate
```

**Theme structure:**
```typescript
// src/themes/kintsugi.ts
export const kintsugi: ThemeConfig = {
  name: 'kintsugi',
  mode: 'light',
  colors: {
    bgPrimary: '#FAF6F1',
    accent: '#C25634',      // Terracotta
    accentHover: '#A84828',
    // ... more colors
  }
};
```

---

### 3. Fonts

**How to change:**

1. Update Google Fonts link in `index.html`:
```html
<link href="https://fonts.googleapis.com/css2?family=NewFont:wght@400;600&display=swap" rel="stylesheet">
```

2. Update CSS variables in `index.css`:
```css
:root {
  --font-display: 'New Display Font', serif;
  --font-body: 'New Body Font', sans-serif;
}
```

---

## Non-Plug & Play Components

### 1. Brand Name

**Current state:** Hardcoded as "Zenote" in 128+ files

**Locations:**
- UI components (`LandingPage.tsx`, `HeaderShell.tsx`, etc.)
- Meta tags (`index.html`)
- PWA manifest (`vite.config.ts`)
- Documentation (`README.md`, `CLAUDE.md`, `docs/`)
- Tests (`e2e/`, `src/**/*.test.ts`)

**To change:** Follow the 7-phase rebrand plan in `docs/plans/yidhan-rebrand-plan.md`

---

### 2. Storage Keys

**Current state:** Hardcoded with `zenote-` prefix

```typescript
// Examples of hardcoded keys:
localStorage.getItem('zenote-theme')
localStorage.getItem('zenote-engagement')
localStorage.getItem('zenote-install-dismissed')
localStorage.getItem('zenote-demo-state')
```

**Files affected:**
- `src/hooks/useInstallPrompt.ts`
- `src/services/demoStorage.ts`
- `src/utils/lazyWithRetry.ts`
- Theme persistence logic

**To change:** Requires code updates + migration logic for existing users

---

### 3. IndexedDB Database

**Current state:** Hardcoded database name

```typescript
// src/lib/offlineDb.ts
class ZenoteDB extends Dexie {
  constructor(userId: string) {
    super(`zenote-offline-${userId}`);
  }
}
```

**To change:** Requires:
1. Code update to new name
2. Migration script to copy data from old DB to new
3. Or: Accept data loss (users re-sync from cloud)

---

### 4. Package & App Configuration

**Files requiring manual update:**

| File | Fields |
|------|--------|
| `package.json` | `name` |
| `capacitor.config.ts` | `appId`, `appName` |
| `android/` folder structure | Package path `com/zenote/app` |

---

## Future Improvement: Centralized Brand Config

To make the brand name plug-and-play, consider creating a centralized config:

```typescript
// src/config/brand.ts (proposed)
export const BRAND = {
  name: 'Yidhan',
  tagline: 'Where ideas find light',
  storagePrefix: 'yidhan',
  appId: 'com.yidhan.app',
  domain: 'yidhan.com',
  colors: {
    primary: '#D4AF37',     // Kintsugi gold
    secondary: '#C25634',   // Terracotta
  }
} as const;

// Usage throughout codebase:
import { BRAND } from '@/config/brand';

localStorage.getItem(`${BRAND.storagePrefix}-theme`);
<title>{BRAND.name}</title>
```

**Trade-offs:**
| Pros | Cons |
|------|------|
| Single source of truth | Adds indirection |
| Easy future rebrands | Slight complexity increase |
| White-label ready | May be overkill for single product |

**Recommendation:** Only implement if anticipating future rebrands or white-label requirements. For a single product, the documented rebrand plan is sufficient.

---

## Quick Reference Commands

```bash
# Regenerate icons after logo change
npm run icons:generate

# Preview theme changes
npm run theme:preview

# Apply theme changes
npm run theme:generate

# Full rebrand (follow plan)
# See: docs/plans/yidhan-rebrand-plan.md
```

---

## Related Documents

- [Yidhan Rebrand Plan](../plans/yidhan-rebrand-plan.md) - 7-phase implementation plan
- [Yidhan Brand Evaluation](yidhan-brand-evaluation-claude.md) - Brand philosophy and meaning
- [Yidhan Logo Design Notes](yidhan-logo-design-claude.md) - Logo design process and guidelines

---

*This document assesses the current branding architecture and provides guidance for future brand changes.*
