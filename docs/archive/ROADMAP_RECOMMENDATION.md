# Changelog & Roadmap Implementation

## Status: Implemented

This document outlines the changelog and roadmap feature for Zenote, designed to build user trust and drive adoption through transparency.

---

## Why This Matters for User Adoption

- **Changelog**: Shows active maintenance, helps users discover features, creates momentum
- **Roadmap**: Builds trust through transparency, makes users feel invested, generates excitement

---

## Navigation Architecture

### Header Strategy

There are **two distinct headers** for different user states:

#### 1. Public Header (before login)

Used on: Landing Page, Changelog, Roadmap

| Position | Element |
|----------|---------|
| Left | Zenote logo (links to home) |
| Center-left | Nav links: Changelog, Roadmap |
| Right | Theme toggle, Sign In button |

#### 2. Authenticated Header (after login)

Used on: Library, Editor

| Position | Element |
|----------|---------|
| Left | Zenote logo |
| Center | Search bar with Cmd+K shortcut |
| Right | New Note button, Theme toggle, Profile avatar (dropdown) |

### Footer Strategy

The **footer is consistent** across ALL pages (public and authenticated):

**Content:** `Changelog  ·  Roadmap  ·  GitHub`

**Rationale:**
- Existing users also want to see what's new and what's coming
- Consistent experience creates familiarity
- Easy access without needing to log out

---

## Design Specifications (Zenote Aligned)

### Colors (CSS Variables)

| Element | Variable |
|---------|----------|
| Background | `var(--color-bg-primary)` |
| Cards | `var(--color-card-bg)` with `backdrop-filter: blur(20px)` |
| Borders | `var(--glass-border)` |
| Text | `var(--color-text-primary)`, `--secondary`, `--tertiary` |
| Accent | `var(--color-accent)` for links and highlights |

### Typography

| Element | Style |
|---------|-------|
| Page title | `var(--font-display)`, 2rem, semibold |
| Section headers | `var(--font-display)`, 1.25rem |
| Body text | `var(--font-body)`, 1rem, weight 300 |
| Dates/metadata | 0.75rem, uppercase, letter-spacing 0.1em |

### Card Styling

- Border radius: `var(--radius-card)` (2px 24px 4px 24px) - signature wabi-sabi corners
- Shadow: `var(--shadow-md)`
- Border: `1px solid var(--glass-border)`
- Dark theme: Additional top highlight border

### Status Badge Colors

| Status | Background | Text |
|--------|------------|------|
| In Progress | `#D4AF3720` | `#D4AF37` (gold) |
| Coming Soon | `#C2563420` | `#C25634` (terracotta) |
| Exploring | `#8B817820` | `#8B8178` (stone) |

### Change Type Icons

| Type | Icon | Color |
|------|------|-------|
| Feature | star | `var(--color-accent)` |
| Improvement | arrow-up | `#87A878` (sage) |
| Fix | check | `#8B8178` (stone) |

---

## File Structure

```
src/
├── data/
│   ├── changelog.ts       # Version history with categorized changes
│   └── roadmap.ts         # Future plans with status indicators
├── components/
│   ├── PublicHeader.tsx   # Shared header for public pages (TODO)
│   ├── Footer.tsx         # Shared footer for all pages
│   ├── ChangelogPage.tsx  # Timeline-style version history
│   └── RoadmapPage.tsx    # Status-grouped feature roadmap
```

---

## Data Structures

### Changelog Entry

```typescript
interface ChangelogEntry {
  version: string;        // e.g., "1.2.0"
  date: string;           // ISO format, e.g., "2024-12-18"
  changes: {
    type: 'feature' | 'improvement' | 'fix';
    text: string;
  }[];
}
```

### Roadmap Item

```typescript
interface RoadmapItem {
  id: string;
  title: string;
  description: string;
  status: 'in-progress' | 'coming-soon' | 'exploring';
}
```

---

## Page Layouts

### Changelog Page

**Header:** PublicHeader (Zenote logo, nav links, theme toggle, Sign In)

**Content:**
- Title: "What's New"
- Subtitle: "All the latest updates and improvements to Zenote."
- Version cards with date badges and categorized changes

**Footer:** Changelog · Roadmap · GitHub

### Roadmap Page

**Header:** PublicHeader (Zenote logo, nav links, theme toggle, Sign In)

**Content:**
- Title: "Roadmap"
- Subtitle: "What we're building and exploring next."
- Sections grouped by status: In Progress, Coming Soon, Exploring
- Feature cards with status badges

**Footer:** Changelog · Roadmap · GitHub

---

## Design Improvement: Unified Public Header

### Current Issue

| Page | Current Header | Problem |
|------|----------------|---------|
| Landing | Logo + Theme + Sign In | Good brand presence |
| Changelog | Back button only | No logo, no theme toggle, feels disconnected |
| Roadmap | Back button only | No logo, no theme toggle, feels disconnected |

### Why Consistency Matters

1. **Wabi-sabi is about harmony** - The Japanese aesthetic celebrates subtle consistency. A jarring header change breaks the meditative flow.

2. **Editorial magazine pattern** - High-quality publications maintain masthead presence across all pages.

3. **User orientation** - Visitors should always know they're in Zenote's world.

4. **Theme toggle access** - Users should be able to switch themes from any page.

### Recommended Solution

Create a `PublicHeader` component shared by:
- LandingPage.tsx
- ChangelogPage.tsx
- RoadmapPage.tsx

**Elements:**
- Logo (left) - Always present, clickable to return home
- Nav links (center-left) - Subtle, tertiary color, accent on hover
- Theme toggle + Sign In (right) - Consistent with landing page

---

## Maintenance

### Adding a New Version to Changelog

Edit `src/data/changelog.ts`:

```typescript
{
  version: '1.4.0',
  date: '2025-01-15',
  changes: [
    { type: 'feature', text: 'New feature description' },
    { type: 'improvement', text: 'Enhancement description' },
    { type: 'fix', text: 'Bug fix description' },
  ],
},
```

### Updating Roadmap Status

Edit `src/data/roadmap.ts` and change the `status` field:
- `'coming-soon'` to `'in-progress'` when work begins
- Remove item when shipped (add to changelog instead)
- Add new items with `'exploring'` status for early ideas

---

## Best Practices

1. **Keep it current** - Update changelog with each release
2. **Be honest** - Don't promise features you're not confident about
3. **Use vague timeframes** - "Coming Soon" instead of specific dates
4. **Celebrate wins** - Move shipped features from roadmap to changelog
5. **Listen to users** - Add frequently requested features to "Exploring"
