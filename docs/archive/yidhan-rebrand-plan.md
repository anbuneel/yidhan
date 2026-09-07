# Yidhan Rebrand Implementation Plan

**Version:** 1.0
**Last Updated:** 2026-01-12
**Status:** Ready for Implementation
**Author:** Claude (Opus 4.5)

---

## Overview

This plan documents all changes required to rebrand from "Zenote" to "Yidhan" across the codebase.

**Scope:**
- 128 files contain "Zenote" or "zenote" references
- 74 occurrences in 33 source files
- Critical changes in config, UI, and metadata

---

## Phase 1: Critical Infrastructure (Do First)

These changes affect app identity and must be done together.

### 1.1 Package Configuration

| File | Change | Priority |
|------|--------|----------|
| `package.json` | `"name": "zenote-app"` → `"name": "yidhan-app"` | 🔴 Critical |
| `package-lock.json` | Will auto-update when you run `npm install` | 🔴 Critical |

### 1.2 HTML & Meta Tags

| File | Line | Change |
|------|------|--------|
| `index.html:16` | `content="Zenote"` → `content="Yidhan"` |
| `index.html:36` | `og:title` → `"Yidhan"` |
| `index.html:39` | `og:url` → `"https://yidhan.com"` (when ready) |
| `index.html:46` | `<title>Zenote</title>` → `<title>Yidhan</title>` |

### 1.3 PWA Manifest (vite.config.ts)

```typescript
// Lines 57-58
manifest: {
  name: 'Yidhan',
  short_name: 'Yidhan',
  // ... rest unchanged
}
```

### 1.4 Capacitor (Native App)

| File | Change |
|------|--------|
| `capacitor.config.ts:4` | `appId: 'com.zenote.app'` → `appId: 'com.yidhan.app'` |
| `capacitor.config.ts:5` | `appName: 'Zenote'` → `appName: 'Yidhan'` |
| `android/app/src/main/assets/capacitor.config.json` | Same changes (auto-generated) |
| `android/app/src/main/res/values/strings.xml` | Update app name |
| `android/app/build.gradle` | Update applicationId if present |
| `android/app/src/main/java/com/zenote/app/MainActivity.java` | Rename package |

**Note:** Android package rename requires folder restructure: `com/zenote/app` → `com/yidhan/app`

---

## Phase 2: User-Facing UI Components

Changes visible to users in the app.

### 2.1 Components with Brand References

| File | Occurrences | Type of Change |
|------|-------------|----------------|
| `src/components/LandingPage.tsx` | 2 | Brand name in hero/copy |
| `src/components/HeaderShell.tsx` | 2 | Logo text, breadcrumb |
| `src/components/Footer.tsx` | 1 | Footer attribution |
| `src/components/Auth.tsx` | 1 | Welcome/signup text |
| `src/components/LettingGoModal.tsx` | 2 | "Let go of Zenote" → "Let go of Yidhan" |
| `src/components/SettingsModal.tsx` | 1 | Settings text |
| `src/components/Editor.tsx` | 1 | Breadcrumb "Zenote" |
| `src/components/SharedNoteView.tsx` | 3 | "Shared via Zenote" → "Shared via Yidhan" |
| `src/components/ErrorBoundary.tsx` | 1 | Error message |
| `src/components/InstallPrompt.tsx` | 1 | Install prompt text |
| `src/components/IOSInstallGuide.tsx` | 3 | iOS install instructions |
| `src/components/PullToRefresh.tsx` | 2 | Loading messages |
| `src/components/TimeRibbon.tsx` | 1 | UI text |
| `src/components/ChangelogPage.tsx` | 1 | Page title/header |

### 2.2 Demo Mode Components

| File | Occurrences | Change |
|------|-------------|--------|
| `src/pages/DemoPage.tsx` | 2 | Demo page branding |
| `src/components/demo/ImpermanenceRibbon.tsx` | 1 | Demo notice text |
| `src/components/demo/InvitationModal.tsx` | 1 | Signup invitation text |

### 2.3 App.tsx

| Line | Change |
|------|--------|
| Multiple | Document title, any brand references |

---

## Phase 3: Data & Storage

Changes to stored data identifiers. **Important:** Consider migration for existing users.

### 3.1 localStorage Keys

| File | Current Key | New Key |
|------|-------------|---------|
| `src/hooks/useInstallPrompt.ts` | `zenote-engagement` | `yidhan-engagement` |
| `src/hooks/useInstallPrompt.ts` | `zenote-install-dismissed` | `yidhan-install-dismissed` |
| `src/services/demoStorage.ts` | `zenote-demo-state` | `yidhan-demo-state` |
| `src/utils/lazyWithRetry.ts` | `zenote-chunk-reload-attempted` | `yidhan-chunk-reload-attempted` |
| (implied in themes) | `zenote-theme` | `yidhan-theme` |

**Migration Strategy:**
```typescript
// Add migration code to check for old keys and copy to new keys
const migrateLocalStorage = () => {
  const oldKeys = [
    ['zenote-engagement', 'yidhan-engagement'],
    ['zenote-install-dismissed', 'yidhan-install-dismissed'],
    ['zenote-demo-state', 'yidhan-demo-state'],
    ['zenote-theme', 'yidhan-theme'],
  ];

  oldKeys.forEach(([oldKey, newKey]) => {
    const value = localStorage.getItem(oldKey);
    if (value && !localStorage.getItem(newKey)) {
      localStorage.setItem(newKey, value);
      localStorage.removeItem(oldKey);
    }
  });
};
```

### 3.2 IndexedDB Database

| File | Current | New |
|------|---------|-----|
| `src/lib/offlineDb.ts` | `zenote-offline-${userId}` | `yidhan-offline-${userId}` |
| `src/lib/offlineDb.ts` | `class ZenoteDB` | `class YidhanDB` |

**Migration Strategy:** IndexedDB migration is more complex. Options:
1. **Simple:** New DB name, old data abandoned (users re-sync)
2. **Complex:** Write migration script to copy data between DBs

### 3.3 Export Filenames

| File | Current | New |
|------|---------|-----|
| `src/utils/exportImport.ts` | `zenote-export-*.md` | `yidhan-export-*.md` |

---

## Phase 4: Tests

Update test expectations to match new brand name.

### 4.1 E2E Tests

| File | Changes Needed |
|------|----------------|
| `e2e/export-import.spec.ts` | `zenote.*\.json` → `yidhan.*\.json` |
| `e2e/export-import.spec.ts` | `zenote.*\.md` → `yidhan.*\.md` |
| `e2e/fixtures.ts` | Button name `/zenote/i` → `/yidhan/i` |
| `e2e/sharing.spec.ts` | "Shared via Zenote" → "Shared via Yidhan" |
| `e2e/sharing.spec.ts` | "Go to Zenote" → "Go to Yidhan" |

### 4.2 Unit Tests

| File | Changes Needed |
|------|----------------|
| `src/hooks/useInstallPrompt.test.ts` | localStorage key references (8 occurrences) |
| `src/utils/exportImport.test.ts` | Filename expectations |
| `src/components/Editor.test.tsx` | Brand name in test expectations |
| `src/components/HeaderShell.test.tsx` | Logo/header expectations |
| `src/components/InstallPrompt.test.tsx` | Install prompt text |

---

## Phase 5: Documentation

Update all documentation references.

### 5.1 Root Documentation

| File | Priority | Notes |
|------|----------|-------|
| `README.md` | 🔴 High | Project description, URLs, badges |
| `CLAUDE.md` | 🔴 High | All Zenote references, URLs |
| `AGENTS.md` | 🔴 High | Synced from CLAUDE.md |

### 5.2 Docs Folder

128 files in `/docs` contain Zenote references. Most are historical/archival.

**Strategy:**
- Update active docs (prd.md, technical-spec.md, ui-layout.md)
- Archive docs can remain as historical record
- Add note at top: "Note: References to 'Zenote' are historical; app was rebranded to 'Yidhan' on [date]"

---

## Phase 6: Assets

### 6.1 New Assets Needed

| Asset | Source | Destination |
|-------|--------|-------------|
| Logo (SVG) | Your design | `public/yidhan-logo.svg` |
| Icon 512x512 | Your design | `public/icons/icon-512x512.png` |
| Icon 192x192 | Your design | `public/icons/icon-192x192.png` |
| Icon 180x180 | Your design | `public/apple-touch-icon.png` |
| Favicon | Your design | `public/favicon.ico` |
| OG Image | Your design | `public/og-image.png` |
| Splash screens | Regenerate | `public/splash/` |

### 6.2 Scripts to Update

| File | Change |
|------|--------|
| `scripts/generate-splash-screens.ts` | Update to use Yidhan logo |

---

## Phase 7: External Services

### 7.1 Vercel

- Update project name (optional)
- Add new domain when ready
- Update environment variables if any contain "zenote"

### 7.2 Supabase

- No changes needed (data is user-scoped)
- Welcome note trigger might reference "Zenote" - check SQL

### 7.3 GitHub

- Repository name: `zenote` → Consider renaming or keeping
- Update repo description
- Update social preview image

### 7.4 Domain/DNS

- Configure yidhan.com when purchased
- Set up redirects from zenote.vercel.app (if keeping)

---

## Implementation Checklist

### Pre-Implementation
- [ ] Purchase yidhan.com domain
- [ ] Export all logo variations
- [ ] Create new app icons and favicon
- [ ] Back up current state (git tag)

### Phase 1: Infrastructure
- [ ] Update package.json
- [ ] Update index.html
- [ ] Update vite.config.ts PWA manifest
- [ ] Update capacitor.config.ts
- [ ] Restructure Android package folders

### Phase 2: UI Components
- [ ] Update LandingPage.tsx
- [ ] Update HeaderShell.tsx
- [ ] Update Footer.tsx
- [ ] Update Auth.tsx
- [ ] Update LettingGoModal.tsx
- [ ] Update SettingsModal.tsx
- [ ] Update Editor.tsx
- [ ] Update SharedNoteView.tsx
- [ ] Update ErrorBoundary.tsx
- [ ] Update InstallPrompt.tsx
- [ ] Update IOSInstallGuide.tsx
- [ ] Update PullToRefresh.tsx
- [ ] Update TimeRibbon.tsx
- [ ] Update ChangelogPage.tsx
- [ ] Update DemoPage.tsx
- [ ] Update demo components
- [ ] Update App.tsx

### Phase 3: Data & Storage
- [ ] Add localStorage migration code
- [ ] Update localStorage keys
- [ ] Update IndexedDB class/name
- [ ] Update export filenames
- [ ] Test migration with existing data

### Phase 4: Tests
- [ ] Update E2E tests
- [ ] Update unit tests
- [ ] Run full test suite
- [ ] Fix any failures

### Phase 5: Documentation
- [ ] Update README.md
- [ ] Update CLAUDE.md
- [ ] Sync AGENTS.md
- [ ] Update key docs in /docs

### Phase 6: Assets
- [ ] Add new logo files
- [ ] Add new icons
- [ ] Regenerate splash screens
- [ ] Update OG image

### Phase 7: External
- [ ] Update Vercel settings
- [ ] Check Supabase triggers
- [ ] Update GitHub repo
- [ ] Configure new domain

### Post-Implementation
- [ ] Run `npm run check` (full CI)
- [ ] Test PWA installation
- [ ] Test Android build
- [ ] Deploy to staging
- [ ] Final QA
- [ ] Deploy to production
- [ ] Announce rebrand

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Existing users lose localStorage data | Migration code copies old keys to new |
| Existing users lose offline data | Consider DB migration or accept re-sync |
| SEO impact | Set up redirects, update meta tags |
| Broken tests | Run full test suite before merge |
| Android app signing | Keep same signing key, just rename |

---

## Estimated Effort

| Phase | Effort | Notes |
|-------|--------|-------|
| Phase 1: Infrastructure | 1-2 hours | Straightforward find/replace |
| Phase 2: UI Components | 2-3 hours | Manual review needed |
| Phase 3: Data & Storage | 1-2 hours | Migration code needed |
| Phase 4: Tests | 1-2 hours | Find/replace + run tests |
| Phase 5: Documentation | 1-2 hours | Bulk update |
| Phase 6: Assets | 2-3 hours | Depends on asset readiness |
| Phase 7: External | 1-2 hours | Vercel, GitHub, DNS |
| **Total** | **10-16 hours** | Spread across 2-3 days recommended |

---

## Commands Reference

```bash
# Full CI check after changes
npm run check

# Run specific test files
npm run test -- src/hooks/useInstallPrompt.test.ts
npm run e2e -- e2e/export-import.spec.ts

# Sync AGENTS.md after CLAUDE.md update
npm run docs:sync-agents

# Rebuild Android after config changes
npm run cap:sync
npm run cap:android

# Generate new splash screens (after updating script)
npx ts-node scripts/generate-splash-screens.ts
```

---

*This plan provides a comprehensive roadmap for the Zenote → Yidhan rebrand. Execute phases in order, testing after each phase.*
