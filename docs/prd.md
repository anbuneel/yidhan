# Yidhan - Product Requirements Document

**Version:** 2.0
**Last Updated:** 2026-01-12
**Status:** Living Document
**Author:** Claude (Opus 4.5)

---

## Original Prompt

> Can you reverse engineer the application and create a Spec and PRD documentation?

---

## Executive Summary

Yidhan is a calm, distraction-free note-taking application — where thoughts bloom with clarity. Named from Tamil origins meaning "Bright Spring," it features a wabi-sabi design philosophy with asymmetric card corners, warm colors, and elegant typography, creating a peaceful digital space for thought capture and reflection.

**Live Product:** https://yidhan.vercel.app
**Repository:** https://github.com/anbuneel/yidhan

---

## Product Vision

> *A quiet space for your mind.*

Zenote aims to be the antithesis of feature-bloated productivity tools. Where other apps compete on features, Zenote competes on restraint. The goal is to provide a digital notebook that feels as natural and unobtrusive as a well-worn Moleskine journal.

### Design Philosophy

| Principle | Implementation |
|-----------|----------------|
| **Wabi-Sabi** | Embrace imperfection through asymmetric corners (2px 24px 4px 24px) |
| **Calm Technology** | Muted color palette, no notifications, no gamification |
| **Honest Presence** | Empty states are not hidden; chapters without notes don't render |
| **Organic Language** | "Faded Notes" instead of "Trash", "Release" instead of "Delete" |

---

## Target Users

### Primary Persona: The Reflective Writer

**Demographics:**
- Age: 25-45
- Profession: Creative professionals, writers, designers, researchers
- Tech Comfort: Moderate to high

**Behaviors:**
- Values aesthetics as much as functionality
- Writes for personal reflection, not productivity optimization
- Prefers quality over quantity of tools
- Seeks digital spaces that feel calm and intentional

**Pain Points:**
- Overwhelmed by feature-rich note apps (Notion, Obsidian)
- Wants a simple tool that doesn't require configuration
- Dislikes aggressive dark patterns (upgrade prompts, gamification)
- Needs cross-device sync without complex setup

**Goals:**
- Capture thoughts quickly without friction
- Organize notes naturally without rigid hierarchies
- Access notes from any device
- Export data without vendor lock-in

### Secondary Persona: The Minimalist Professional

**Demographics:**
- Age: 30-50
- Profession: Executives, consultants, academics

**Behaviors:**
- Uses multiple productivity tools daily
- Seeks a "zen" space separate from work tools
- Values privacy and data ownership

---

## Feature Requirements

### Core Features (Implemented)

#### 1. Note Management

| Feature | Description | Priority |
|---------|-------------|----------|
| Rich Text Editor | Bold, italic, underline, headers (H1-H3), lists, quotes, code blocks, task lists | P0 |
| Auto-Save | Debounced save (1.5s) with visual feedback ("Saving..." → "Saved ✓") | P0 |
| Slash Commands | Quick formatting via `/h1`, `/bullet`, `/todo`, `/date`, `/time`, etc. | P1 |
| Pin Notes | Pin important notes to top of library | P1 |
| Soft Delete | "Faded Notes" with 30-day recovery window | P1 |

#### 2. Organization

| Feature | Description | Priority |
|---------|-------------|----------|
| Temporal Chapters | Automatic grouping: Pinned, This Week, Last Week, This Month, Earlier, Archive | P0 |
| Tag System | Multiple tags per note with 8 wabi-sabi colors | P0 |
| Tag Filtering | Filter library by one or more tags | P1 |
| Search | Full-text search with Cmd/Ctrl+K shortcut | P0 |
| Collapsible Sections | Expand/collapse chapter sections with preview | P2 |

#### 3. Authentication & Account

| Feature | Description | Priority |
|---------|-------------|----------|
| Email/Password Auth | Standard authentication with password reset | P0 |
| Google OAuth | One-click sign-in via Google | P0 |
| GitHub OAuth | One-click sign-in via GitHub | P1 |
| Profile Management | Display name, avatar (initials-based) | P1 |
| Account Offboarding | "Letting Go" with 14-day grace period | P2 |

#### 4. Data Portability

| Feature | Description | Priority |
|---------|-------------|----------|
| JSON Export | Full backup with notes, tags, and metadata | P0 |
| Markdown Export | Combined .md file with all notes | P1 |
| JSON Import | Restore from backup with tag recreation | P0 |
| Markdown Import | Import single or multiple notes | P1 |
| Clipboard Copy | Copy note as plain text or with formatting | P2 |

#### 5. Sharing

| Feature | Description | Priority |
|---------|-------------|----------|
| Share as Letter | Temporary read-only share links | P1 |
| Configurable Expiration | 1 day, 7 days, 30 days, or never | P1 |
| Public View | Beautiful read-only view for recipients | P1 |

#### 6. Theme System

| Feature | Description | Priority |
|---------|-------------|----------|
| Dark/Light Toggle | System-aware with manual override | P0 |
| Kintsugi Theme (Light) | Warm aged paper, terracotta accents | P0 |
| Midnight Theme (Dark) | Deep forest green, antique gold accents (default) | P0 |

#### 7. Offline & Sync

| Feature | Description | Priority |
|---------|-------------|----------|
| Offline Editing | Edit notes without internet via IndexedDB (Dexie.js) | P0 |
| Sync Queue | Pending changes queue with automatic sync on reconnect | P0 |
| Conflict Detection | Detects concurrent edits to same note | P1 |
| "Two Paths" Modal | Visual conflict resolution (keep local, keep remote, or merge) | P1 |
| Sync Indicator | Subtle status showing offline/pending state | P2 |

#### 8. Progressive Web App (PWA)

| Feature | Description | Priority |
|---------|-------------|----------|
| Installable App | Add to home screen on mobile and desktop | P0 |
| Share Target API | Receive shared text from other apps | P1 |
| Custom Install Prompt | Zen-styled prompt after 3+ notes or 2+ visits | P2 |
| Cached Assets | Offline app shell with service worker | P1 |

#### 9. Practice Space (Demo Mode)

| Feature | Description | Priority |
|---------|-------------|----------|
| Full Demo Experience | Complete note-taking at /demo without signup | P0 |
| Local Persistence | Demo notes saved in localStorage | P0 |
| Soft Signup Prompts | Gentle "invitation" after 3+ notes and 5+ minutes | P1 |
| Impermanence Ribbon | Reminder that demo notes aren't synced to cloud | P2 |
| Demo Migration | Auto-migrate demo notes on signup (with tag deduplication) | P0 |

#### 10. Native Mobile (Capacitor)

| Feature | Description | Priority |
|---------|-------------|----------|
| Android App | Native Android wrapper via Capacitor WebView | P1 |
| iOS App (Planned) | Native iOS wrapper (requires macOS + Xcode) | P2 |
| Hydration Timeout | Defense-in-depth protection for Android loading | P1 |

#### 11. UX Enhancements

| Feature | Description | Priority |
|---------|-------------|----------|
| View Transitions API | Smooth page navigation (Chrome/Edge/Safari) | P2 |
| WhisperBack Button | Floating back button for long notes (scroll-triggered) | P2 |
| Chapter Navigation | Desktop dot sidebar + Mobile time ribbon scrubber | P1 |
| Sticky Toolbar | Formatting toolbar stays visible while scrolling | P1 |

### Planned Features (Roadmap)

| Feature | Status | Description |
|---------|--------|-------------|
| Zero-Knowledge E2EE | Planning | Full end-to-end encryption (Standard Notes-style) |
| Image Attachments | Coming Soon | Add images and diagrams to notes |
| Virtual Scrolling | Coming Soon | Performance for large note collections |
| Public Garden | Exploring | Toggle notes as minimal public blog |
| Additional OAuth | Exploring | Apple Sign-In and other providers |
| Analytics | Exploring | Privacy-respecting usage insights |

---

## User Flows

### 1. New User Onboarding

```
Landing Page → "Start Writing" CTA → Auth Modal (Sign Up)
                                            ↓
                                    Email Confirmation
                                            ↓
                                    Library (with welcome note)
```

**Demo-to-Signup Flow:**
- User types in demo editor on landing page
- "Save this note" CTA appears after typing
- Demo content auto-migrates as first note after signup

### 1b. Practice Space Flow (New)

```
Landing Page → "Explore without signing up" → Practice Space (/demo)
                                                      ↓
                                               Full note library
                                                      ↓
                                               Create notes (localStorage)
                                                      ↓
                                    After 3+ notes, 5+ min → Soft signup prompt
                                                      ↓
                                               Sign up → Demo notes migrate to account
```

**Key behaviors:**
- Notes persist in localStorage (survives browser refresh)
- Impermanence ribbon reminds notes aren't cloud-synced
- Gentle "invitation" modal (not aggressive popup)
- Tags supported, migrate with deduplication on signup

### 2. Note Creation

```
Library → [+ New Note] or Cmd/Ctrl+N → Editor
                                          ↓
                                   Title focused (new note)
                                          ↓
                                   Type content (auto-save)
                                          ↓
                                   Escape or back → Library
```

### 3. Note Organization

```
Note Card → Pin button → Note moves to "Pinned" chapter
         → Delete button → Confirmation → Faded Notes
         → Click → Editor → Add tags via Tag Selector
```

### 4. Recovery Flow

```
Profile Menu → Faded Notes → Note Card
                               ↓
                        [Restore] → Back to library
                        [Release] → Permanent delete
```

### 5. Sharing Flow

```
Editor → Share button → Share Modal
                           ↓
                    Select expiration
                           ↓
                    Copy link → Share externally
                           ↓
                    Recipient opens → Public read-only view
```

### 6. Offline Editing Flow (New)

```
Online → Make edits → Auto-save to Supabase
           ↓
       Lose connection
           ↓
Offline → Make edits → Save to IndexedDB (sync queue)
           ↓
       SyncIndicator shows pending count
           ↓
       Reconnect → Auto-sync queued changes
           ↓
       Conflict detected? → "Two Paths" modal
                               ↓
                        Choose: Keep local / Keep remote / Merge
```

---

## Non-Functional Requirements

### Performance

| Metric | Target |
|--------|--------|
| Initial Load (LCP) | < 2.5s |
| Time to Interactive | < 3.5s |
| Auto-save Latency | < 500ms |
| Search Response | < 100ms |

### Security

| Requirement | Implementation |
|-------------|----------------|
| Data Isolation | Row Level Security (RLS) on all tables |
| XSS Prevention | DOMPurify sanitization on all user content |
| Auth Security | Supabase Auth with secure session handling |
| Share Links | Cryptographically secure 32-character tokens |

### Accessibility

| Requirement | Status |
|-------------|--------|
| Keyboard Navigation | Full support (Space key, Tab, shortcuts) |
| Screen Reader Support | Semantic HTML, ARIA labels |
| Color Contrast | WCAG AA compliant |

### Reliability

| Metric | Target |
|--------|--------|
| Uptime | 99.9% (via Vercel + Supabase) |
| Data Durability | 99.999999999% (Supabase/AWS) |
| Save Retry | 3 attempts with exponential backoff |

---

## Success Metrics

### Engagement Metrics

| Metric | Description |
|--------|-------------|
| Weekly Active Users | Users who create/edit at least 1 note per week |
| Notes per User | Average notes created per active user |
| Session Duration | Time spent in app per session |
| Return Rate | % of users returning within 7 days |

### Quality Metrics

| Metric | Description |
|--------|-------------|
| Error Rate | % of failed saves/operations |
| Core Web Vitals | LCP, FID, CLS scores |
| Crash-Free Sessions | % via Sentry monitoring |

### Product-Specific Metrics

| Metric | Description |
|--------|-------------|
| Tag Adoption | % of notes with at least one tag |
| Share Usage | % of users who create share links |
| Export Usage | % of users who export data |
| Theme Preference | Light vs Dark usage split |

---

## Constraints & Assumptions

### Technical Constraints

- **PWA-first with native option:** PWA for web, Capacitor for Android (iOS planned)
- **No real-time collaboration:** Single-user notes only (design choice)
- **Offline-capable:** Full offline editing with IndexedDB, sync on reconnect

### Business Constraints

- **Free tier only:** No paid plans currently
- **No analytics tracking:** Privacy-first approach
- **No advertising:** Clean, unmonetized experience

### Assumptions

1. Users prefer simplicity over feature completeness
2. Users value aesthetic design as much as functionality
3. Users are comfortable with web applications
4. Target users have reliable internet access

---

## Appendix

### Competitive Landscape

| Product | Positioning | Zenote Differentiation |
|---------|-------------|------------------------|
| Apple Notes | Simple, ecosystem-locked | Cross-platform, exportable, zero-knowledge E2EE |
| Notion | Feature-rich, complex | Simple, calm, zero-knowledge (Notion has NO E2EE) |
| Bear | Beautiful, paid, optional E2EE | Free, web-first, full E2EE by default |
| Obsidian | Powerful, local-first | Simpler, cloud-synced with E2EE |
| Standard Notes | Encrypted, minimal | Similar privacy model, more refined wabi-sabi UX |

#### Encryption Comparison

| Product | E2EE | Developer Can Read Notes | Zero-Knowledge |
|---------|------|--------------------------|----------------|
| Notion | ❌ No | ✅ Yes | ❌ No |
| Bear | ⚠️ Optional (per-note) | ⚠️ Unencrypted only | ⚠️ Partial |
| Standard Notes | ✅ All notes | ❌ Never | ✅ Yes |
| **Zenote (Planned)** | ✅ All notes | ❌ Never | ✅ Yes |

*See [encryption-capability-analysis-claude.md](analysis/encryption-capability-analysis-claude.md) for detailed analysis.*

### Glossary

| Term | Definition |
|------|------------|
| Wabi-Sabi | Japanese aesthetic embracing imperfection and impermanence |
| Faded Notes | Soft-deleted notes awaiting permanent release |
| Temporal Chapters | Automatic grouping of notes by time period |
| Kintsugi | Art of repairing broken pottery with gold (light theme name) |
| Letting Go | Account offboarding flow with grace period |
| Practice Space | Full-featured demo mode at /demo requiring no signup |
| Two Paths | Conflict resolution modal for concurrent edits (offline sync) |
| Impermanence Ribbon | Gentle reminder that demo notes aren't synced to cloud |
| WhisperBack | Floating back button that appears when scrolled down |
| Share Target | PWA API allowing the app to receive shared content from other apps |
| Zero-Knowledge | Architecture where even the service provider cannot access user data |
| E2EE | End-to-end encryption where only the user holds decryption keys |

---

*This PRD is reverse-engineered from the implemented product and serves as living documentation. Last major update: January 2026 (v2.0).*
