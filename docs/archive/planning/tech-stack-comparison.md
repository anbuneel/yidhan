# Tech Stack Comparison: Recommendation vs. Implementation

This document compares the recommended tech stack from `tech-stack-reco.md` against what has been implemented in Zenote.

## Summary Table

| Layer | Recommended | Implemented | Status |
|-------|-------------|-------------|--------|
| Framework | Next.js 14+ (App Router) | Vite + React 18 (SPA) | Different |
| Language | TypeScript | TypeScript | Aligned |
| Database | PostgreSQL (Supabase/Neon) | PostgreSQL (Supabase) | Aligned |
| ORM | Prisma | Supabase Client (direct) | Different |
| Editor | TipTap | TipTap | Aligned |
| Styling | Tailwind CSS + shadcn/ui | Tailwind CSS (custom components) | Partial |
| Animations | Framer Motion | CSS Transitions | Different |
| State | TanStack Query | React useState/useEffect | Different |
| Deployment | Vercel | Not deployed | Pending |
| Auth | Supabase Auth / Clerk | Supabase Auth | Aligned |

---

## Detailed Analysis

### Aligned (Matching Recommendations)

#### TypeScript
- **Recommendation:** Strict type safety for complex note/data relationships
- **Implementation:** Full TypeScript with strict mode
- **Assessment:** Fully aligned

#### PostgreSQL via Supabase
- **Recommendation:** Relational data integrity, serverless scaling
- **Implementation:** Supabase PostgreSQL with Row Level Security
- **Assessment:** Fully aligned. Using Supabase's built-in features for auth and real-time sync.

#### TipTap Editor
- **Recommendation:** Headless rich-text editor for custom, minimal UI
- **Implementation:** TipTap with StarterKit, Placeholder, Underline, TextAlign, Highlight extensions
- **Assessment:** Fully aligned. Custom toolbar matching the wabi-sabi aesthetic.

#### Supabase Auth
- **Recommendation:** Supabase Auth or Clerk for authentication
- **Implementation:** Supabase Auth with email/password
- **Assessment:** Aligned. OAuth providers (Google, GitHub) not yet added.

#### Real-time Subscriptions
- **Recommendation:** Supabase Realtime for instant sync
- **Implementation:** Supabase real-time subscriptions for notes
- **Assessment:** Fully aligned. Changes sync across tabs/devices.

---

### Partially Aligned

#### Tailwind CSS
- **Recommendation:** Tailwind CSS + shadcn/ui for rapid, accessible styling
- **Implementation:** Tailwind CSS v4 with custom CSS variables and components
- **Assessment:** Partially aligned. Using Tailwind but built custom components instead of shadcn/ui. Custom design system matches wabi-sabi aesthetic better than generic component library.

#### Optimistic Updates
- **Recommendation:** TanStack Query for optimistic updates (instant saving feel)
- **Implementation:** Local state updates immediately, debounced server sync (500ms)
- **Assessment:** Partially aligned. Achieves the same UX goal through different means. UI feels instant, syncs in background.

#### Content Storage Format
- **Recommendation:** TipTap JSON structure for easier search/formatting
- **Implementation:** HTML (via `editor.getHTML()`)
- **Assessment:** Partial deviation. HTML works but JSON would be better for:
  - Full-text search on structured content
  - Future semantic/AI search
  - Content manipulation

---

### Different Approaches

#### Framework: Next.js vs. Vite + React

| Aspect | Next.js (Recommended) | Vite + React (Implemented) |
|--------|----------------------|---------------------------|
| SEO | SSR/SSG for marketing pages | Client-side only |
| Routing | File-based with App Router | React state-based views |
| API Routes | Built-in Server Actions | Supabase handles backend |
| Bundle Size | Larger, more features | Smaller, faster dev |
| Complexity | Higher | Lower |

**Trade-off Analysis:**
- Next.js would be better for: SEO, marketing pages, server-side rendering
- Vite + React is simpler for: MVP development, pure SPA apps
- **Recommendation:** Consider migrating to Next.js when adding marketing/landing pages

#### ORM: Prisma vs. Supabase Client

| Aspect | Prisma (Recommended) | Supabase Client (Implemented) |
|--------|---------------------|------------------------------|
| Type Safety | Generated types from schema | Manual type definitions |
| Queries | Intuitive ORM syntax | SQL-like builder |
| Migrations | Built-in migration system | Supabase dashboard/SQL |
| Complexity | Additional layer | Direct to database |

**Trade-off Analysis:**
- Prisma would be better for: Complex queries (folders + tags + search)
- Supabase client is simpler for: Basic CRUD, real-time subscriptions
- **Recommendation:** Consider Prisma when adding folders/tags organization

#### Animations: Framer Motion vs. CSS Transitions

| Aspect | Framer Motion (Recommended) | CSS Transitions (Implemented) |
|--------|----------------------------|------------------------------|
| Complexity | More powerful, steeper learning | Simple, native |
| Bundle Size | Additional dependency (~30KB) | Zero additional |
| Capabilities | Layout animations, gestures, orchestration | Basic transitions |
| "Zen" Feel | Better for polished interactions | Adequate for MVP |

**Trade-off Analysis:**
- Framer Motion would be better for: Note deletion animations, folder expand/collapse, page transitions
- CSS transitions work for: Hover effects, simple state changes
- **Recommendation:** Add Framer Motion when polishing UX (post-MVP)

#### State Management: TanStack Query vs. React State

| Aspect | TanStack Query (Recommended) | React State (Implemented) |
|--------|-----------------------------|-----------------------------|
| Caching | Automatic, intelligent | Manual |
| Refetching | Built-in stale-while-revalidate | Manual implementation |
| Optimistic Updates | First-class support | Custom debounce logic |
| DevTools | Excellent debugging | Browser DevTools |

**Trade-off Analysis:**
- TanStack Query would be better for: Complex data fetching, offline support, error handling
- React state is simpler for: MVP with straightforward data flow
- **Recommendation:** Consider TanStack Query when adding search, offline mode

---

## Features Not Yet Implemented

From the roadmap, these features from the recommendation are pending:

| Feature | Recommended Approach | Priority |
|---------|---------------------|----------|
| Folders | Prisma relations, sidebar nav | High |
| Tags | Many-to-many relations | Medium |
| Search | PostgreSQL Full-Text Search | High |
| AI Search | pgvector for semantic search | Low (Phase 2) |
| SaaS/Billing | Stripe integration | Low |
| Pinned Notes | `isPinned` boolean field | Medium |

---

## Recommendations for Next Steps

### Short-term (Align with recommendations)
1. **Add Folders/Tags** - Will require schema changes
2. **Implement Search** - PostgreSQL full-text search
3. **Switch content to JSON** - Better for search and future features

### Medium-term (Enhance UX)
1. **Add Framer Motion** - For polished animations
2. **Consider TanStack Query** - For better data management
3. **Add OAuth providers** - Google, GitHub login

### Long-term (Scale)
1. **Migrate to Next.js** - If SEO/marketing pages needed
2. **Add Prisma** - If query complexity increases
3. **Implement AI search** - pgvector for semantic search

---

## Conclusion

The current implementation aligns with **~60% of the recommendations**, prioritizing:
- Core functionality (editor, database, auth)
- Developer velocity (simpler stack)
- Custom design (wabi-sabi aesthetic)

The deviations are reasonable trade-offs for an MVP. The recommended enhancements (Next.js, Prisma, Framer Motion, TanStack Query) can be incrementally adopted as the product matures.
