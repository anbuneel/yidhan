# Logo & Branding Requirements

**Author:** Claude (Opus 4.5)
**Date:** 2025-12-26
**Status:** Planning

---

## Current State

- **Wordmark:** "Zenote" in Cormorant Garamond (display font)
- **Symbol/Icon:** None (needs creation)
- **Color palette:** Terracotta (#C25634) / Antique Gold (#D4AF37)

---

## Minimum Requirements

| Asset | Purpose | Status |
|-------|---------|--------|
| **Favicon** | Browser tab | Needs verification |
| **PWA Icon** | Home screen install (192x192, 512x512) | Needs verification |
| **OG Image** | Social sharing preview | Likely missing |
| **Wordmark** | Header/branding | Done (Cormorant "Zenote") |
| **Monogram** | Small sizes, app icon | Needed |

---

## Do We Need a Symbol Logo?

**Not necessarily.** Many successful apps use wordmarks only:
- Notion (just "N" in a box)
- Linear (wordmark)
- Stripe (wordmark)

But a **monogram or symbol** helps for:
- Small sizes (favicon, app icon)
- Recognition without text
- Social media profile
- Merchandise (someday)

---

## Logo Concepts That Fit Zenote's Aesthetic

| Concept | Description | Complexity |
|---------|-------------|------------|
| **Stylized Z** | The letter Z with wabi-sabi asymmetric corners | Low |
| **Enso + Z** | Zen circle (brush stroke) with Z integrated | Medium |
| **Paper fold** | Abstract folded paper corner forming a Z | Medium |
| **Minimal brush stroke** | Single Japanese-style brush mark | Low |
| **Asymmetric square** | Square with wabi-sabi corners, Z inside | Low |

---

## Recommended Approach

### Phase 1: MVP (Before Launch)

**Create a simple monogram "Z"** using Cormorant Garamond with asymmetric corner styling:

```
┌──────────────────┐
│                  │
│      Z           │  ← Cormorant Garamond
│                  │
└──────────────────┘
     ↑
  Asymmetric corners (2px 24px 4px 24px)
```

**Why this works:**
- On-brand (uses existing typography)
- Quick to create
- Works at all sizes
- Can evolve later

**Generate these sizes:**
- 16x16 (favicon)
- 32x32 (favicon @2x)
- 180x180 (Apple touch icon)
- 192x192 (PWA icon)
- 512x512 (PWA icon large)
- 1200x630 (OG image for social sharing)

### Phase 2: Post-Launch (If Needed)

Consider hiring a designer for:
- Custom symbol that's more distinctive
- Full brand guidelines
- Marketing assets

---

## Color Usage

| Context | Light Theme | Dark Theme |
|---------|-------------|------------|
| Icon background | Terracotta (#C25634) | Antique Gold (#D4AF37) |
| Icon foreground | White (#FFFFFF) | Dark (#050A06) |
| Favicon | Terracotta on transparent | Terracotta on transparent |

---

## Open Graph Image

For social sharing, create a simple OG image:

```
┌─────────────────────────────────────────────┐
│                                             │
│              Zenote                         │
│                                             │
│     A quiet space for your mind.            │
│                                             │
└─────────────────────────────────────────────┘
```

- Size: 1200x630px
- Background: Primary color (theme-appropriate)
- Typography: Cormorant Garamond for "Zenote", Inter for tagline

---

## Next Steps

- [ ] Verify existing PWA icons in `/public/icons/`
- [ ] Create monogram "Z" with asymmetric styling
- [ ] Generate all required icon sizes
- [ ] Create OG image for social sharing
- [ ] Update `manifest.webmanifest` with correct icon paths
- [ ] Test PWA install on iOS and Android
