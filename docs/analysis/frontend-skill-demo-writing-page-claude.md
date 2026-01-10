# Zenote Full Demo Page Design

**Version:** 1.0
**Last Updated:** 2026-01-09
**Status:** Living Document
**Author:** Claude (Opus 4.5)
**Consulted:** Frontend Design Skill

---

## Original Prompt

> Let's explore creating a full blown demo page where users can experience the full writing experience without having to login. Use the frontend-design skill to come up with a UI and UX design that removes any friction for the user. Refer to the current login page implementation, user onboarding docs and other docs to see if we have formed any opinions.
>
> User clarifications:
> - Landing page has teaser that links to /demo for full experience
> - 3-5 notes allowed with soft signup prompt after
> - Full feature parity with authenticated experience

---

## Design Philosophy: "The Practice Space"

### Conceptual Direction

Drawing from the Japanese concept of **keikoba** (practice space) - a sanctuary where mastery is cultivated through repetition - the demo experience should feel like a **sanctuary for writing practice**, not a limited trial.

**Core Metaphor:** *Your thoughts are like sand mandalas - beautiful in their impermanence, yet worthy of preservation.*

This philosophy informs:
- **No countdown timers or aggressive limits** - that's antithetical to calm
- **Gentle reminders of impermanence** - "These notes live in your browser"
- **Invitation, not demand** - "When you're ready to keep them forever..."

### Aesthetic Continuity

The demo page must feel like a natural extension of Zenote, not a "demo mode" with watermarks or restrictions. Users should experience the **full aesthetic** without visual degradation.

**What changes in demo mode:**
- Subtle indicator that notes are local-only
- Soft prompt after creating 3+ notes
- Migration flow when signing up

**What stays the same:**
- Full Tiptap editor with all features
- Theme toggle (light/dark)
- Tag creation and organization
- Pin functionality
- Masonry card layout
- All keyboard shortcuts

---

## Page Architecture

### Route Structure

```
/                    -> Landing page (with demo teaser)
/demo                -> Full demo experience (library + editor)
/demo/new            -> Demo editor for new note
/demo/:localId       -> Demo editor for existing note
```

### Data Flow

```
+------------------------------------------------------------------+
|                        DEMO STATE                                |
+------------------------------------------------------------------+
|                                                                  |
|   localStorage: 'zenote-demo-state'                              |
|   +--------------------------------------------------------+    |
|   |  {                                                     |    |
|   |    notes: Note[],                                      |    |
|   |    tags: Tag[],                                        |    |
|   |    metadata: {                                         |    |
|   |      createdAt: timestamp,                             |    |
|   |      totalNotes: number,  // for soft prompt trigger   |    |
|   |      promptDismissedAt: timestamp | null               |    |
|   |    }                                                   |    |
|   |  }                                                     |    |
|   +--------------------------------------------------------+    |
|                                                                  |
|   On Signup -> Migrate to Supabase -> Clear localStorage         |
|                                                                  |
+------------------------------------------------------------------+
```

---

## UI Design: Landing Page Teaser

### Current State Enhancement

The current landing page demo card becomes a **portal** to the full experience. Below the existing demo editor, add a CTA:

```
+--------------------------------------------------------------+
|                                                              |
|  +-- DEMO CARD --------------------------------------------+ |
|  |                                                         | |
|  |  [Try it here]                              [Demo]      | |
|  |                                                         | |
|  |  Start typing...                                        | |
|  |  _                                                      | |
|  |                                                         | |
|  |---------------------------------------------------------| |
|  |                                                         | |
|  |  +---------------------------------------------------+  | |
|  |  |  * Open the full writing space                    |  | |
|  |  |    No signup required                             |  | |
|  |  +---------------------------------------------------+  | |
|  |                                                         | |
|  +---------------------------------------------------------+ |
|                                                              |
+--------------------------------------------------------------+
```

### Teaser CTA Design

**Placement:** Below the demo editor, appearing after 2 seconds or when user starts typing

**Copy options (wabi-sabi tone):**
- "Open the full writing space" (primary)
- "Try the complete experience"
- "Enter the practice space"

**Visual treatment:**

```css
.demo-portal-cta {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--glass-border);
  border-radius: 2px 12px 4px 12px;
  transition: all 0.3s ease;
}

.demo-portal-cta:hover {
  border-color: var(--color-accent);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px var(--color-accent-glow);
}

.demo-portal-cta::before {
  content: '*';
  color: var(--color-accent);
  font-size: 14px;
}

.demo-portal-cta-text {
  font-family: var(--font-display);
  font-size: 1.1rem;
  color: var(--color-text-primary);
}

.demo-portal-cta-subtext {
  font-family: var(--font-body);
  font-size: 0.8rem;
  color: var(--color-text-tertiary);
  margin-top: 2px;
}
```

---

## UI Design: Demo Page (/demo)

### Layout: Full-Screen Writing Sanctuary

```
+--------------------------------------------------------------+
|  [ Zenote ]                          [Theme] [Sign In]       |
+--------------------------------------------------------------+
|                                                              |
|  +-- IMPERMANENCE RIBBON (subtle) -------------------------+ |
|  |  o Your notes are safe in this browser . Sign up to sync | |
|  +----------------------------------------------------------+ |
|                                                              |
|  +----------------------------------------------------------+|
|  |  [Search... Cmd+K]                        [+ New Note]   ||
|  +----------------------------------------------------------+|
|                                                              |
|  +-- TAG FILTER BAR ----------------------------------------+|
|  |  All  |  Journal  |  Ideas  |  + Add Tag                 ||
|  +----------------------------------------------------------+|
|                                                              |
|  +----------------------------------------------------------+|
|  |                                                          ||
|  |  +--------------+  +--------------+  +--------------+    ||
|  |  | Morning      |  | Book notes   |  | Ideas for    |    ||
|  |  | reflections  |  |              |  | the garden   |    ||
|  |  |              |  | Key insight  |  |              |    ||
|  |  | The quiet    |  | from Atomic  |  | Plant the    |    ||
|  |  | hours...     |  | Habits...    |  | roses near   |    ||
|  |  |              |  |              |  | the...       |    ||
|  |  | [Journal]    |  | [Reading]    |  | [Ideas]      |    ||
|  |  | 2 days ago   |  | 1 week ago   |  | Just now     |    ||
|  |  +--------------+  +--------------+  +--------------+    ||
|  |                                                          ||
|  +----------------------------------------------------------+|
|                                                              |
|  +-- FOOTER ------------------------------------------------+|
|  |  Changelog . Roadmap . GitHub                            ||
|  +----------------------------------------------------------+|
|                                                              |
+--------------------------------------------------------------+
```

### Impermanence Ribbon

A subtle, non-intrusive banner that reminds users their notes are browser-local:

```css
.impermanence-ribbon {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--color-bg-secondary) 20%,
    var(--color-bg-secondary) 80%,
    transparent 100%
  );
  font-family: var(--font-body);
  font-size: 0.8rem;
  color: var(--color-text-tertiary);
}

.impermanence-ribbon::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-accent);
  opacity: 0.6;
  animation: gentle-pulse 3s ease-in-out infinite;
}

@keyframes gentle-pulse {
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.2); }
}

.impermanence-ribbon a {
  color: var(--color-accent);
  text-decoration: none;
  border-bottom: 1px dotted var(--color-accent);
  transition: border-color 0.2s;
}

.impermanence-ribbon a:hover {
  border-bottom-style: solid;
}
```

**Copy:** "Your notes are safe in this browser . [Sign up to sync across devices]"

**Behavior:**
- Dismissible (stores dismissal in localStorage)
- Re-appears after 7 days if user hasn't signed up
- Can be minimized to just the pulsing dot

---

## Soft Signup Prompt Design

### Trigger Conditions

The soft prompt appears when **ALL** conditions are met:
1. User has created **3 or more notes**
2. User has spent **at least 5 minutes** in the demo
3. User has **not dismissed** a prompt in the last 24 hours

### Prompt Variant A: The Invitation (Primary)

Appears as a modal overlay with zen-styled blur background:

```
+--------------------------------------------------------------+
|                                                              |
|           +--------------------------------------+            |
|           |                                      |            |
|           |      * A Gentle Invitation           |            |
|           |                                      |            |
|           |   You've written 3 notes here.       |            |
|           |   They're yours to keep.             |            |
|           |                                      |            |
|           |   Create a free account and          |            |
|           |   your words will travel with        |            |
|           |   you everywhere.                    |            |
|           |                                      |            |
|           |   +------------------------------+   |            |
|           |   |     Keep My Notes            |   |            |
|           |   +------------------------------+   |            |
|           |                                      |            |
|           |        Continue without              |            |
|           |                                      |            |
|           +--------------------------------------+            |
|                                                              |
+--------------------------------------------------------------+
```

**CSS for the invitation modal:**

```css
.invitation-modal {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(8px);
  z-index: 100;
  animation: fade-in 0.4s ease-out;
}

.invitation-card {
  width: 100%;
  max-width: 400px;
  margin: 16px;
  padding: 40px 32px;
  background: var(--color-card-bg);
  border: 1px solid var(--glass-border);
  border-radius: 2px 24px 4px 24px;
  text-align: center;
  animation: float-up 0.5s ease-out;
}

@keyframes float-up {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.invitation-icon {
  font-size: 1.5rem;
  color: var(--color-accent);
  margin-bottom: 16px;
}

.invitation-title {
  font-family: var(--font-display);
  font-size: 1.5rem;
  color: var(--color-text-primary);
  margin-bottom: 20px;
  letter-spacing: -0.02em;
}

.invitation-body {
  font-family: var(--font-body);
  font-size: 1rem;
  color: var(--color-text-secondary);
  line-height: 1.7;
  margin-bottom: 28px;
}

.invitation-body strong {
  color: var(--color-accent);
  font-weight: 500;
}

.invitation-cta {
  width: 100%;
  padding: 14px 24px;
  background: var(--color-accent);
  color: #fff;
  font-family: var(--font-body);
  font-size: 1rem;
  font-weight: 500;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 16px var(--color-accent-glow);
}

.invitation-cta:hover {
  background: var(--color-accent-hover);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px var(--color-accent-glow);
}

.invitation-dismiss {
  margin-top: 16px;
  font-family: var(--font-body);
  font-size: 0.875rem;
  color: var(--color-text-tertiary);
  background: none;
  border: none;
  cursor: pointer;
  text-decoration: underline;
  text-decoration-style: dotted;
  text-underline-offset: 3px;
  transition: color 0.2s;
}

.invitation-dismiss:hover {
  color: var(--color-text-secondary);
}
```

### Prompt Variant B: The Inline Nudge

For users who dismissed the modal, show a subtle inline nudge in the header area:

```
+--------------------------------------------------------------+
|  [ Zenote ]       +---------------------------+    [Sign In] |
|                   | 5 notes . Ready to sync?  |              |
|                   +---------------------------+              |
+--------------------------------------------------------------+
```

```css
.inline-nudge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--glass-border);
  border-radius: 20px;
  font-family: var(--font-body);
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.inline-nudge:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}
```

### Prompt Variant C: The Organic Footer

At the bottom of the note library, after all notes:

```
+--------------------------------------------------------------+
|                                                              |
|  +--------------+  +--------------+  +--------------+        |
|  | Note 4       |  | Note 5       |  | + Create     |        |
|  |              |  |              |  |              |        |
|  +--------------+  +--------------+  +--------------+        |
|                                                              |
|  - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  |
|                                                              |
|         +----------------------------------------+           |
|         |                                        |           |
|         |   Your practice space holds 5 notes    |           |
|         |                                        |           |
|         |   +--------------------------------+   |           |
|         |   |  Create account to keep them   |   |           |
|         |   +--------------------------------+   |           |
|         |                                        |           |
|         +----------------------------------------+           |
|                                                              |
+--------------------------------------------------------------+
```

---

## Demo Editor Experience

### Full Feature Parity

The demo editor includes **everything** the authenticated editor has:

```
+--------------------------------------------------------------+
|  [ Zenote / Untitled ]                   [Theme] [Sign In]   |
+--------------------------------------------------------------+
|                                                              |
|  +-- EDITOR TOOLBAR ----------------------------------------+|
|  |  B  I  U  |  H1  H2  H3  |  *  1.  [ ]  |  "  </>  --    ||
|  +----------------------------------------------------------+|
|                                                              |
|  +----------------------------------------------------------+|
|  |                                                          ||
|  |  Morning reflections                                     ||
|  |  --------------------                                    ||
|  |                                                          ||
|  |  The quiet hours before dawn have become my favorite     ||
|  |  time to think clearly. There's something about the      ||
|  |  stillness that invites honesty.                         ||
|  |                                                          ||
|  |  ## What I'm grateful for                                ||
|  |                                                          ||
|  |  - The sound of rain on the window                       ||
|  |  - A warm cup of tea                                     ||
|  |  - This moment of quiet                                  ||
|  |                                                          ||
|  |  > "In the midst of movement and chaos, keep stillness   ||
|  |  > inside of you."                                       ||
|  |                                                          ||
|  +----------------------------------------------------------+|
|                                                              |
|  +-- TAG SELECTOR ------------------------------------------+|
|  |  [Journal x]  [Personal x]  |  + Add tag                 ||
|  +----------------------------------------------------------+|
|                                                              |
|  +-- METADATA ----------------------------------------------+|
|  |  Created: Jan 9, 2026 . Edited: Just now . Saved         ||
|  +----------------------------------------------------------+|
|                                                              |
+--------------------------------------------------------------+
```

### Slash Commands (Demo Mode)

All slash commands work identically:

| Command | Action |
|---------|--------|
| `/h1`, `/h2`, `/h3` | Insert heading |
| `/bullet`, `/list` | Bulleted list |
| `/number`, `/ordered` | Numbered list |
| `/todo`, `/task` | Task list |
| `/quote` | Block quote |
| `/code` | Code block |
| `/divider`, `/hr` | Horizontal rule |
| `/date` | Insert current date |
| `/time` | Insert current time |
| `/now` | Insert date and time |

### Keyboard Shortcuts (Demo Mode)

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + N` | New note |
| `Cmd/Ctrl + K` | Search |
| `Cmd/Ctrl + B` | Bold |
| `Cmd/Ctrl + I` | Italic |
| `Cmd/Ctrl + U` | Underline |
| `Cmd/Ctrl + Shift + C` | Copy note |
| `Escape` | Return to library |

---

## Data Persistence Strategy

### Storage Schema

```typescript
// src/services/demoStorage.ts

interface DemoState {
  notes: DemoNote[];
  tags: DemoTag[];
  metadata: {
    createdAt: number;           // First demo session
    lastVisit: number;           // Last activity
    totalNotes: number;          // Cumulative notes created
    promptDismissedAt: number | null;  // Soft prompt dismissal
    ribbonDismissedAt: number | null;  // Impermanence ribbon
  };
}

interface DemoNote {
  localId: string;              // uuid v4
  title: string;
  content: string;              // HTML from Tiptap
  pinned: boolean;
  tagIds: string[];
  createdAt: number;
  updatedAt: number;
}

interface DemoTag {
  localId: string;
  name: string;
  color: TagColor;
  createdAt: number;
}

const DEMO_STORAGE_KEY = 'zenote-demo-state';

// Initialize with welcome note
const DEFAULT_DEMO_STATE: DemoState = {
  notes: [{
    localId: 'welcome-note',
    title: 'Welcome to your practice space',
    content: `<p>This is your quiet corner for writing. Everything you create here is saved in your browser.</p>
<h2>Try these features</h2>
<ul>
  <li>Type <code>/</code> for slash commands</li>
  <li>Press <code>Cmd+N</code> to create a new note</li>
  <li>Add tags to organize your thoughts</li>
</ul>
<p>When you're ready, create an account to sync across devices.</p>`,
    pinned: false,
    tagIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }],
  tags: [
    { localId: 'tag-journal', name: 'Journal', color: 'terracotta', createdAt: Date.now() },
    { localId: 'tag-ideas', name: 'Ideas', color: 'gold', createdAt: Date.now() },
  ],
  metadata: {
    createdAt: Date.now(),
    lastVisit: Date.now(),
    totalNotes: 1,
    promptDismissedAt: null,
    ribbonDismissedAt: null,
  },
};
```

### Storage Operations

```typescript
// Read demo state
export function getDemoState(): DemoState {
  try {
    const stored = localStorage.getItem(DEMO_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Update last visit
      parsed.metadata.lastVisit = Date.now();
      saveDemoState(parsed);
      return parsed;
    }
  } catch (e) {
    console.error('Failed to read demo state:', e);
  }
  // Initialize with defaults
  saveDemoState(DEFAULT_DEMO_STATE);
  return DEFAULT_DEMO_STATE;
}

// Save demo state
export function saveDemoState(state: DemoState): void {
  try {
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save demo state:', e);
  }
}

// Migration to authenticated account
export async function migrateDemoToAccount(userId: string): Promise<{
  migratedNotes: number;
  migratedTags: number;
}> {
  const state = getDemoState();

  // Create tags first (to get real IDs)
  const tagIdMap = new Map<string, string>();
  for (const tag of state.tags) {
    const realTag = await createTag({
      user_id: userId,
      name: tag.name,
      color: tag.color,
    });
    tagIdMap.set(tag.localId, realTag.id);
  }

  // Create notes with mapped tag IDs
  for (const note of state.notes) {
    if (note.localId === 'welcome-note') continue; // Skip demo welcome note

    const realNote = await createNote({
      user_id: userId,
      title: note.title,
      content: note.content,
      pinned: note.pinned,
    });

    // Attach tags
    for (const localTagId of note.tagIds) {
      const realTagId = tagIdMap.get(localTagId);
      if (realTagId) {
        await attachTagToNote(realNote.id, realTagId);
      }
    }
  }

  // Clear demo state
  localStorage.removeItem(DEMO_STORAGE_KEY);

  return {
    migratedNotes: state.notes.filter(n => n.localId !== 'welcome-note').length,
    migratedTags: state.tags.length,
  };
}
```

---

## Migration Flow (Demo to Account)

### Visual Flow

```
User clicks "Keep My Notes" or "Sign Up"
           |
           v
+--------------------------------------------------------------+
|                                                              |
|         +----------------------------------------+           |
|         |                                        |           |
|         |      * Your notes will be saved        |           |
|         |                                        |           |
|         |   After signing up, we'll move your    |           |
|         |   3 notes and 2 tags to your           |           |
|         |   new account automatically.           |           |
|         |                                        |           |
|         |   +--------------------------------+   |           |
|         |   |  Continue with Google          |   |           |
|         |   +--------------------------------+   |           |
|         |                                        |           |
|         |   +--------------------------------+   |           |
|         |   |  Continue with GitHub          |   |           |
|         |   +--------------------------------+   |           |
|         |                                        |           |
|         |   ------------ or ------------         |           |
|         |                                        |           |
|         |   +--------------------------------+   |           |
|         |   |  Sign up with email            |   |           |
|         |   +--------------------------------+   |           |
|         |                                        |           |
|         +----------------------------------------+           |
|                                                              |
+--------------------------------------------------------------+
           |
           v
      Auth completes
           |
           v
+--------------------------------------------------------------+
|                                                              |
|         +----------------------------------------+           |
|         |                                        |           |
|         |      [checkmark] Migration complete    |           |
|         |                                        |           |
|         |   3 notes and 2 tags have been         |           |
|         |   moved to your account.               |           |
|         |                                        |           |
|         |   They'll now sync across all your     |           |
|         |   devices.                             |           |
|         |                                        |           |
|         |   +--------------------------------+   |           |
|         |   |  Open your library             |   |           |
|         |   +--------------------------------+   |           |
|         |                                        |           |
|         +----------------------------------------+           |
|                                                              |
+--------------------------------------------------------------+
```

---

## Mobile Responsive Design

### Mobile Demo Library

```
+--------------------------+
| [ Zenote ]    [sun] [->] |
+--------------------------+
|                          |
| o Notes saved locally    |
|                          |
| +----------------------+ |
| | Search...       [+]  | |
| +----------------------+ |
|                          |
| +--------------------+   |
| | All | Journal | -> |   |
| +--------------------+   |
|                          |
| +------------------------+
| | Morning reflections    |
| |                        |
| | The quiet hours...     |
| |                        |
| | [Journal]    2 days    |
| +------------------------+
|                          |
| +------------------------+
| | Book notes             |
| |                        |
| | Key insight from...    |
| |                        |
| | [Reading]    1 week    |
| +------------------------+
|                          |
|        - - - - -         |
|                          |
|   3 notes . Sign up ->   |
|                          |
+--------------------------+
```

### Mobile-Specific Considerations

1. **Touch-friendly targets:** All buttons minimum 44x44px
2. **Swipe gestures:** Swipe right on note card to pin, swipe left to delete
3. **Bottom sheet for tags:** Tag selector appears as bottom sheet on mobile
4. **Sticky toolbar:** Editor toolbar sticks to top on scroll
5. **Safe area insets:** Respect notch and home indicator areas

```css
@media (max-width: 640px) {
  .demo-page {
    padding-bottom: env(safe-area-inset-bottom);
  }

  .impermanence-ribbon {
    font-size: 0.75rem;
    padding: 8px 12px;
  }

  .note-card {
    border-radius: 2px 16px 4px 16px;
  }

  .editor-toolbar {
    position: sticky;
    top: 0;
    z-index: 10;
    background: var(--color-bg-primary);
    border-bottom: 1px solid var(--glass-border);
  }

  .tag-selector-mobile {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: var(--color-card-bg);
    border-top: 1px solid var(--glass-border);
    border-radius: 16px 16px 0 0;
    padding: 20px;
    padding-bottom: calc(20px + env(safe-area-inset-bottom));
    transform: translateY(100%);
    transition: transform 0.3s ease;
  }

  .tag-selector-mobile.open {
    transform: translateY(0);
  }
}
```

---

## Component Architecture

### New Components Needed

```
src/components/
  demo/
    DemoPage.tsx           # Main demo route component
    DemoLibrary.tsx        # Demo note library with masonry grid
    DemoEditor.tsx         # Full Tiptap editor for demo
    DemoHeader.tsx         # Demo-specific header with sign-in
    ImpermanenceRibbon.tsx # Subtle local-storage indicator
    InvitationModal.tsx    # Soft signup prompt modal
    InlineNudge.tsx        # Header inline signup nudge
    MigrationModal.tsx     # Post-signup migration flow
    DemoNoteCard.tsx       # Note card with demo actions

src/services/
  demoStorage.ts           # localStorage operations

src/hooks/
  useDemoState.ts          # Demo state React hook
  useSoftPrompt.ts         # Soft prompt trigger logic
```

### Hook: useDemoState

```typescript
// src/hooks/useDemoState.ts

import { useState, useEffect, useCallback } from 'react';
import {
  getDemoState,
  saveDemoState,
  createDemoNote,
  updateDemoNote,
  deleteDemoNote,
  type DemoState,
  type DemoNote,
} from '../services/demoStorage';

export function useDemoState() {
  const [state, setState] = useState<DemoState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const demoState = getDemoState();
    setState(demoState);
    setLoading(false);
  }, []);

  const createNote = useCallback((note: Omit<DemoNote, 'localId' | 'createdAt' | 'updatedAt'>) => {
    const newNote = createDemoNote(note);
    setState(getDemoState());
    return newNote;
  }, []);

  const updateNote = useCallback((localId: string, updates: Partial<DemoNote>) => {
    const updated = updateDemoNote(localId, updates);
    setState(getDemoState());
    return updated;
  }, []);

  const deleteNote = useCallback((localId: string) => {
    const deleted = deleteDemoNote(localId);
    setState(getDemoState());
    return deleted;
  }, []);

  const dismissPrompt = useCallback(() => {
    if (!state) return;
    const newState = {
      ...state,
      metadata: {
        ...state.metadata,
        promptDismissedAt: Date.now(),
      },
    };
    saveDemoState(newState);
    setState(newState);
  }, [state]);

  return {
    notes: state?.notes ?? [],
    tags: state?.tags ?? [],
    metadata: state?.metadata ?? null,
    loading,
    createNote,
    updateNote,
    deleteNote,
    dismissPrompt,
  };
}
```

### Hook: useSoftPrompt

```typescript
// src/hooks/useSoftPrompt.ts

import { useMemo } from 'react';
import { useDemoState } from './useDemoState';

const MIN_NOTES_FOR_PROMPT = 3;
const MIN_TIME_FOR_PROMPT = 5 * 60 * 1000; // 5 minutes
const PROMPT_COOLDOWN = 24 * 60 * 60 * 1000; // 24 hours

export function useSoftPrompt() {
  const { notes, metadata, dismissPrompt } = useDemoState();

  const shouldShowPrompt = useMemo(() => {
    if (!metadata) return false;

    // Check note count
    const noteCount = notes.filter(n => n.localId !== 'welcome-note').length;
    if (noteCount < MIN_NOTES_FOR_PROMPT) return false;

    // Check time spent
    const timeSpent = Date.now() - metadata.createdAt;
    if (timeSpent < MIN_TIME_FOR_PROMPT) return false;

    // Check if dismissed recently
    if (metadata.promptDismissedAt) {
      const timeSinceDismiss = Date.now() - metadata.promptDismissedAt;
      if (timeSinceDismiss < PROMPT_COOLDOWN) return false;
    }

    return true;
  }, [notes, metadata]);

  const shouldShowInlineNudge = useMemo(() => {
    if (!metadata) return false;

    // Show inline nudge if user has dismissed the modal prompt
    const noteCount = notes.filter(n => n.localId !== 'welcome-note').length;
    return metadata.promptDismissedAt !== null && noteCount >= MIN_NOTES_FOR_PROMPT;
  }, [notes, metadata]);

  const noteCount = notes.filter(n => n.localId !== 'welcome-note').length;

  return {
    shouldShowPrompt,
    shouldShowInlineNudge,
    noteCount,
    dismissPrompt,
  };
}
```

---

## Animation & Micro-interactions

### Page Transitions

```css
/* Demo page entrance */
.demo-page-enter {
  animation: page-fade-in 0.4s ease-out;
}

@keyframes page-fade-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Note card stagger on load */
.note-card {
  animation: card-appear 0.4s ease-out backwards;
}

.note-card:nth-child(1) { animation-delay: 0.05s; }
.note-card:nth-child(2) { animation-delay: 0.1s; }
.note-card:nth-child(3) { animation-delay: 0.15s; }
.note-card:nth-child(4) { animation-delay: 0.2s; }
.note-card:nth-child(5) { animation-delay: 0.25s; }

@keyframes card-appear {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### Interaction Feedback

```css
/* Note card hover */
.note-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.note-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
}

/* Save indicator */
.save-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  color: var(--color-text-tertiary);
  transition: color 0.2s;
}

.save-indicator.saving {
  color: var(--color-accent);
}

.save-indicator.saved::before {
  content: 'check';
  animation: checkmark-pop 0.3s ease-out;
}

@keyframes checkmark-pop {
  0% { transform: scale(0); }
  50% { transform: scale(1.3); }
  100% { transform: scale(1); }
}
```

---

## Accessibility Considerations

### Keyboard Navigation

- All interactive elements focusable
- Focus trap in modals
- Escape key to close modals/dismiss prompts

### Screen Reader Support

```html
<!-- Impermanence ribbon -->
<div
  role="status"
  aria-live="polite"
  aria-label="Your notes are saved in this browser. Sign up to sync across devices."
>
  ...
</div>

<!-- Invitation modal -->
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="invitation-title"
  aria-describedby="invitation-body"
>
  <h2 id="invitation-title">A Gentle Invitation</h2>
  <p id="invitation-body">...</p>
</div>
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Implementation Phases

### Phase 1: Core Demo Infrastructure
- [ ] Create `demoStorage.ts` service
- [ ] Create `useDemoState` hook
- [ ] Create `DemoPage.tsx` route component
- [ ] Integrate existing `ChapteredLibrary` with demo data source
- [ ] Integrate existing `Editor` with demo save/load

### Phase 2: Demo-Specific UI
- [ ] Create `ImpermanenceRibbon.tsx`
- [ ] Create `InvitationModal.tsx`
- [ ] Create `InlineNudge.tsx`
- [ ] Update `LandingPage.tsx` with portal CTA
- [ ] Add `/demo` route to router

### Phase 3: Migration Flow
- [ ] Create `MigrationModal.tsx`
- [ ] Implement `migrateDemoToAccount()` function
- [ ] Hook migration into auth success callback
- [ ] Add migration success state

### Phase 4: Polish & Testing
- [ ] Mobile responsive testing
- [ ] Accessibility audit
- [ ] Animation refinement
- [ ] E2E tests for demo flow
- [ ] Performance optimization

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Demo -> Signup conversion | > 15% | Users who sign up after using demo |
| Demo engagement | > 3 notes avg | Average notes created before signup |
| Demo retention | > 40% return | Users who return to demo within 7 days |
| Migration success | > 95% | Successful note migrations |
| Prompt dismissal rate | < 50% | Users who dismiss soft prompt |

---

## Appendix: Copy Variations

### Impermanence Ribbon
- "Your notes are safe in this browser"
- "Notes saved locally . Sign up to sync"
- "Your practice space . Browser-only"

### Invitation Modal Title
- "A Gentle Invitation"
- "Your Words, Everywhere"
- "Keep What You've Written"

### Invitation Modal Body
- "You've written {n} notes here. They're yours to keep. Create a free account and your words will travel with you everywhere."
- "These {n} notes live only in this browser. Sign up to keep them safe and sync across all your devices."
- "{n} thoughts, captured. Create an account to preserve them beyond this browser."

### CTA Buttons
- "Keep My Notes" (primary)
- "Continue without" (dismiss)
- "Sign up to sync" (inline)

---

## Implementation Status

**Implementation Date:** 2026-01-09
**Branch:** `feature/demo-writing-page`
**Status:** Complete (pending merge)

### Files Created

| File | Purpose | Status |
|------|---------|--------|
| `src/services/demoStorage.ts` | LocalStorage CRUD for demo notes, tags, metadata | Complete |
| `src/hooks/useDemoState.ts` | React state management, type conversion | Complete |
| `src/hooks/useSoftPrompt.ts` | Prompt trigger logic (3+ notes, 5+ min) | Complete |
| `src/components/demo/ImpermanenceRibbon.tsx` | Subtle "local-only" banner | Complete |
| `src/components/demo/InvitationModal.tsx` | Soft signup prompt modal | Complete |
| `src/pages/DemoPage.tsx` | Main demo experience (library + editor) | Complete |

### Files Modified

| File | Changes |
|------|---------|
| `src/App.tsx` | Added `/demo` route detection, demo migration effect |
| `src/components/LandingPage.tsx` | Added "Practice" links (hero + footer) |

### Implementation Notes

1. **Route Structure:** Simplified to single `/demo` route (no nested routes needed)
2. **State Management:** Uses lazy useState initialization instead of useEffect for demo state
3. **Type Compatibility:** Demo types converted to existing Note/Tag types for component reuse
4. **Migration:** Automatic migration of notes + tags on signup with toast notification
5. **Prompt Logic:** Shows after 3+ user notes AND 5+ minutes, 24h cooldown after dismiss

### Verification Results

- TypeCheck: PASS
- Lint: PASS
- Build: PASS (DemoPage chunk: ~15KB gzipped: ~5KB)
- Tests: Pre-existing Vitest environment issue (unrelated to changes)

### Deviations from Design

1. **Simplified routing:** Used single `/demo` route with internal view state instead of nested routes
2. **Inline nudge:** Not implemented (modal + ribbon provide sufficient prompt coverage)
3. **Organic footer prompt:** Not implemented (modal covers this use case)
4. **Migration confirmation modal:** Simplified to toast notification for less friction
5. **Landing page CTA consolidation:** Removed "Or explore without signing up" link - redundant with "Practice" in footer. Demo card ("Try it here") provides inline quick editor; "Practice" link provides full /demo experience

---

## Testing Plan

### Manual Testing Checklist

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Visit `http://localhost:5173` | Landing page with "explore without signing up" link |
| 2 | Click "Practice" or the explore link | Redirects to `/demo` |
| 3 | See empty library | Welcome note appears, ImpermanenceRibbon at top |
| 4 | Click "New Note" or `Ctrl+N` | Editor opens with full Tiptap toolbar |
| 5 | Type, format, use slash commands | All editor features work |
| 6 | Go back to library | Note appears in library grid |
| 7 | Create 3+ notes, wait 5 min | InvitationModal appears (soft signup prompt) |
| 8 | Dismiss modal | Can continue using demo |
| 9 | Refresh browser | Notes persist (localStorage) |
| 10 | Click "Sign up" from modal | Auth modal opens |
| 11 | Complete signup | Demo notes migrate to account |

### Quick Smoke Test

To test soft prompt without waiting 5 minutes, temporarily modify `src/hooks/useSoftPrompt.ts`:

```typescript
// Change from 5 minutes to 10 seconds
const MIN_TIME_FOR_PROMPT_MS = 10 * 1000;
```

### Feature Coverage

| Feature | Demo Mode | Authenticated Mode |
|---------|-----------|-------------------|
| Rich text editor (Tiptap) | ✅ | ✅ |
| Formatting toolbar | ✅ | ✅ |
| Slash commands | ✅ | ✅ |
| Tags (create, assign) | ✅ | ✅ |
| Pin notes | ✅ | ✅ |
| Search | ✅ | ✅ |
| Theme toggle | ✅ | ✅ |
| Keyboard shortcuts | ✅ | ✅ |
| Cloud sync | ❌ (localStorage) | ✅ |
| Cross-device access | ❌ | ✅ |

---

*Document generated as part of Zenote demo experience design initiative.*
