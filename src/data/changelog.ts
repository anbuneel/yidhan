export type ChangeType = 'feature' | 'improvement' | 'fix';

export interface ChangelogEntry {
  version: string;
  date: string;
  changes: { type: ChangeType; text: string }[];
}

export const changelog: ChangelogEntry[] = [
  {
    version: '2.8.0',
    date: '2026-01-20',
    changes: [
      { type: 'feature', text: 'Resume where you left off - cursor and scroll position restored when reopening notes' },
      { type: 'feature', text: '"Resume" chip appears for long notes, letting you jump to your last editing spot' },
      { type: 'improvement', text: 'Editor positions persist across sessions (stored in localStorage)' },
      { type: 'fix', text: 'Focus decision now uses current content state instead of saved content' },
    ],
  },
  {
    version: '2.7.0',
    date: '2026-01-16',
    changes: [
      { type: 'feature', text: 'Button press states - tactile scale feedback on tap for native feel' },
      { type: 'feature', text: 'Visual Viewport API - proper keyboard handling with CSS variables' },
      { type: 'feature', text: 'Gesture hint overlay - one-time tutorial for swipe gestures on mobile' },
      { type: 'feature', text: 'iOS-style bottom sheet - Settings modal slides up on mobile' },
      { type: 'improvement', text: 'iOS install guide detects non-Safari browsers with "Open in Safari" prompt' },
    ],
  },
  {
    version: '2.6.1',
    date: '2026-01-15',
    changes: [
      { type: 'improvement', text: 'Mobile landing page: Sign In link now visible without scrolling' },
      { type: 'improvement', text: 'Reordered CTAs: "explore first" before "sign in" follows natural user journey' },
    ],
  },
  {
    version: '2.6.0',
    date: '2026-01-15',
    changes: [
      { type: 'feature', text: 'Automatic condensed cards on mobile - compact view shows more notes on small screens' },
      { type: 'improvement', text: 'Responsive card sizing - full cards on desktop, compact on mobile (<700px)' },
    ],
  },
  {
    version: '2.5.2',
    date: '2026-01-13',
    changes: [
      { type: 'fix', text: 'App no longer auto-refreshes when switching browser tabs - update prompt shown instead' },
      { type: 'improvement', text: 'Offline chunk errors now properly fall back to ErrorBoundary for retry' },
      { type: 'improvement', text: 'Reduced service worker update frequency from hourly to every 4 hours' },
    ],
  },
  {
    version: '2.5.1',
    date: '2026-01-12',
    changes: [
      { type: 'fix', text: 'Sync queue entries now clear correctly after processing to prevent stuck pending counts' },
    ],
  },
  {
    version: '2.5.0',
    date: '2026-01-12',
    changes: [
      { type: 'feature', text: 'Landing page redesign - cleaner split layout with sample note cards and trust signals' },
      { type: 'feature', text: 'OAuth-first auth - Google/GitHub sign-in buttons now appear first for faster onboarding' },
      { type: 'improvement', text: 'Practice Space access - "Explore" link prominently surfaces the full demo experience' },
      { type: 'improvement', text: 'Reduced dark mode grain for a calmer visual experience' },
    ],
  },
  {
    version: '2.4.0',
    date: '2026-01-11',
    changes: [
      { type: 'feature', text: 'Session timeout - auto-logout after 30 minutes with 5-minute warning modal' },
      { type: 'feature', text: 'Keyboard shortcuts modal - press ? to see all shortcuts, slash commands, and gestures' },
      { type: 'feature', text: 'Full account backup - export all data including share links when leaving' },
      { type: 'improvement', text: 'Rate limit handling - graceful 429 error detection with automatic retry' },
      { type: 'improvement', text: 'Retry-After header support for respecting server-specified wait times' },
      { type: 'improvement', text: 'Shortcuts link added to footer for easy access to help' },
    ],
  },
  {
    version: '2.3.1',
    date: '2026-01-11',
    changes: [
      { type: 'fix', text: 'Note cards now have proper vertical spacing on touch devices' },
      { type: 'fix', text: 'Sync queue entries no longer get stuck forever when exceptions occur' },
      { type: 'fix', text: 'Stale sync entries (>1hr, 3+ retries) are automatically cleaned up' },
      { type: 'fix', text: 'Pull-to-refresh now correctly detects scroll position with nested containers' },
      { type: 'fix', text: 'Swipe-to-delete gracefully recovers UI if delete fails (shake animation feedback)' },
      { type: 'fix', text: 'iOS install guide animation completes smoothly on dismiss' },
      { type: 'fix', text: 'Improved compatibility with older iOS Safari versions (iOS < 14)' },
      { type: 'improvement', text: 'Swipe gesture feels snappier (150ms vs 200ms delay)' },
    ],
  },
  {
    version: '2.3.0',
    date: '2026-01-10',
    changes: [
      { type: 'feature', text: 'iOS Safari install guide - visual tutorial for adding Yidhan to home screen' },
      { type: 'feature', text: 'Apple splash screens - branded launch images for all iOS devices' },
      { type: 'feature', text: 'Swipe gestures - swipe left to delete, right to pin/unpin notes (mobile)' },
      { type: 'feature', text: 'Pull-to-refresh - pull down on note list to sync (mobile)' },
      { type: 'improvement', text: 'iOS-style spring animations for cards, modals, and transitions' },
      { type: 'improvement', text: 'Card entrance animation with cascading stagger effect' },
    ],
  },
  {
    version: '2.2.0',
    date: '2026-01-09',
    changes: [
      { type: 'feature', text: 'Practice Space - full demo experience at /demo without signing up' },
      { type: 'feature', text: 'Demo notes persist in browser localStorage with full editor features' },
      { type: 'feature', text: 'Soft signup prompt after creating 3+ notes and spending 5+ minutes' },
      { type: 'feature', text: 'Automatic migration of demo notes when you create an account' },
      { type: 'improvement', text: '"Explore without signing up" link added to landing page' },
    ],
  },
  {
    version: '2.1.1',
    date: '2026-01-09',
    changes: [
      { type: 'fix', text: 'Android app no longer gets stuck on loading screen after login (defense-in-depth timeout protection)' },
      { type: 'improvement', text: 'IndexedDB operations now have timeout protection for Android WebView edge cases' },
    ],
  },
  {
    version: '2.1.0',
    date: '2026-01-08',
    changes: [
      { type: 'feature', text: 'Share Target - share text from other apps directly to Yidhan (Android/Chrome)' },
      { type: 'feature', text: 'Install prompt - friendly reminder to add Yidhan to your home screen after engagement' },
      { type: 'improvement', text: 'Install link added to landing page footer for easy PWA installation' },
    ],
  },
  {
    version: '2.0.0',
    date: '2026-01-07',
    changes: [
      { type: 'feature', text: 'Offline editing - notes now persist locally and sync automatically when you reconnect' },
      { type: 'feature', text: 'Conflict resolution - "Two Paths" modal helps you choose when edits conflict' },
      { type: 'feature', text: 'Sync indicator - subtle status shows pending changes and offline state' },
      { type: 'fix', text: 'Mobile time ribbon touch targets improved for easier navigation' },
    ],
  },
  {
    version: '1.9.11',
    date: '2025-12-29',
    changes: [
      { type: 'fix', text: 'Dark mode delete button now uses proper red color instead of coral' },
      { type: 'improvement', text: 'Delete confirmation dialog accessibility improvements' },
    ],
  },
  {
    version: '1.9.10',
    date: '2025-12-29',
    changes: [
      { type: 'improvement', text: 'Smart chunk loading - auto-retries and quietly reloads on version updates when safe' },
      { type: 'improvement', text: 'Preserves unsaved work during version updates by detecting active editing' },
    ],
  },
  {
    version: '1.9.9',
    date: '2025-12-29',
    changes: [
      { type: 'fix', text: 'Shared notes now viewable by unauthenticated users (fixed RLS policy)' },
    ],
  },
  {
    version: '1.9.8',
    date: '2025-12-29',
    changes: [
      { type: 'improvement', text: 'Codebase cleanup - removed ~230 lines of verified dead code' },
      { type: 'improvement', text: 'Removed legacy Library component (replaced by ChapteredLibrary)' },
      { type: 'improvement', text: 'Removed unused theme utilities and type exports' },
    ],
  },
  {
    version: '1.9.7',
    date: '2025-12-28',
    changes: [
      { type: 'improvement', text: 'Smart retry logic - 4xx errors fail fast, only network/5xx errors retry' },
      { type: 'improvement', text: 'Save tracking - navigation now awaits in-flight saves to prevent data loss' },
      { type: 'improvement', text: 'Sentry privacy - note content masked in session replays' },
      { type: 'improvement', text: 'Accessibility - Space key now works for keyboard navigation' },
      { type: 'improvement', text: 'Error tokens - consistent error colors across light and dark themes' },
    ],
  },
  {
    version: '1.9.6',
    date: '2025-12-28',
    changes: [
      { type: 'fix', text: 'Honest offline messaging - no longer implies sync capability that does not exist' },
      { type: 'improvement', text: 'Defense-in-depth XSS protection - shared notes now explicitly sanitized' },
      { type: 'fix', text: 'Delete race condition - fixed stale closure bug in note deletion' },
    ],
  },
  {
    version: '1.9.5',
    date: '2025-12-28',
    changes: [
      { type: 'feature', text: 'Auto-retry for note saves - 3 attempts with exponential backoff on network failure' },
      { type: 'improvement', text: 'Honest save status - indicator now reflects actual save result, not just timer' },
      { type: 'improvement', text: 'Error notification - toast message when save fails after retries' },
      { type: 'fix', text: 'Optimistic update rollback - reverts local changes if server save fails' },
    ],
  },
  {
    version: '1.9.4',
    date: '2025-12-28',
    changes: [
      { type: 'improvement', text: 'Share link privacy notice - tooltip explains browser history implications' },
      { type: 'improvement', text: 'Security documentation - share token implementation verified and documented' },
    ],
  },
  {
    version: '1.9.3',
    date: '2025-12-28',
    changes: [
      { type: 'improvement', text: 'Bundle optimization - 44% reduction in initial load size (596KB → 332KB)' },
      { type: 'improvement', text: 'Lazy loading for views, modals, and vendor dependencies' },
      { type: 'improvement', text: 'Vendor chunking - Supabase, Sentry, React cached independently' },
    ],
  },
  {
    version: '1.9.2',
    date: '2025-12-28',
    changes: [
      { type: 'improvement', text: 'Accessibility improvements - proper ARIA roles for dialogs, menus, and form labels' },
      { type: 'improvement', text: 'Auth modal now supports Escape key to close (with dirty form confirmation)' },
      { type: 'improvement', text: 'E2E test infrastructure updated for auth and notes flows' },
    ],
  },
  {
    version: '1.9.1',
    date: '2025-12-26',
    changes: [
      { type: 'feature', text: 'GitHub OAuth login - sign in with your GitHub account' },
      { type: 'improvement', text: 'OAuth buttons now displayed side-by-side for cleaner layout' },
    ],
  },
  {
    version: '1.9.0',
    date: '2025-12-26',
    changes: [
      { type: 'feature', text: 'Share as Letter - create temporary, read-only links to share notes quietly' },
      { type: 'feature', text: 'Configurable link expiration - 1 day, 7 days, 30 days, or never' },
      { type: 'feature', text: 'Beautiful shared note view - read-only display with preserved formatting and tags' },
      { type: 'improvement', text: 'Share links respect wabi-sabi philosophy - impermanent, one-way, no tracking' },
    ],
  },
  {
    version: '1.8.0',
    date: '2025-12-26',
    changes: [
      { type: 'feature', text: 'Account offboarding ("Letting Go") - graceful departure with 14-day grace period' },
      { type: 'feature', text: 'Export keepsakes before departing - download your notes as Markdown or JSON' },
      { type: 'feature', text: 'Return during grace period - sign back in to cancel departure and stay' },
      { type: 'improvement', text: 'Wabi-sabi offboarding language - "fade", "release", "keepsakes" instead of delete/cancel' },
    ],
  },
  {
    version: '1.7.1',
    date: '2025-12-25',
    changes: [
      { type: 'feature', text: 'Copy note to clipboard - plain text or with formatting for pasting anywhere' },
      { type: 'feature', text: 'Keyboard shortcut Cmd/Ctrl+Shift+C to copy entire note' },
      { type: 'improvement', text: 'Reorganized export menu with copy options and download sections' },
      { type: 'improvement', text: 'Friendly "New version available" message when app updates during use' },
      { type: 'fix', text: 'Auto-refresh when deployment causes chunk loading errors' },
    ],
  },
  {
    version: '1.7.0',
    date: '2025-12-25',
    changes: [
      { type: 'feature', text: 'PWA support - install Yidhan to your home screen for app-like experience' },
      { type: 'feature', text: 'Offline app shell - UI loads instantly even without connection' },
      { type: 'improvement', text: 'Warm paper texture on light mode for consistent wabi-sabi feel' },
      { type: 'improvement', text: 'Zen-style network messages - calm, non-alarming offline notifications' },
    ],
  },
  {
    version: '1.6.5',
    date: '2025-12-24',
    changes: [
      { type: 'fix', text: 'Hide password settings tab for Google OAuth users (they authenticate via Google)' },
    ],
  },
  {
    version: '1.6.4',
    date: '2025-12-24',
    changes: [
      { type: 'improvement', text: 'Faded Notes now uses consistent header with theme toggle and profile menu' },
    ],
  },
  {
    version: '1.6.3',
    date: '2025-12-24',
    changes: [
      { type: 'improvement', text: 'Fade animation when deleting notes - gentle visual transition before removal' },
      { type: 'improvement', text: 'Organic time phrases in Faded Notes - "Just arrived", "Resting quietly", "Fading gently", "Nearly gone"' },
      { type: 'improvement', text: 'Enhanced Faded Notes visual treatment - sepia tint, softer shadows, lighter typography' },
      { type: 'improvement', text: 'Removed delete confirmation dialog - undo toast provides quicker, less intrusive safety net' },
    ],
  },
  {
    version: '1.6.2',
    date: '2025-12-24',
    changes: [
      { type: 'improvement', text: 'Softer language for Faded Notes - "Release" instead of "Delete Forever", "Keep Resting" instead of "Cancel"' },
      { type: 'improvement', text: 'Undo toast when deleting notes - 5 second window to restore' },
      { type: 'improvement', text: 'Forward-looking time display - "Releasing in X days" instead of "X days left"' },
      { type: 'improvement', text: 'Updated empty state copy - "Nothing fading away" with friendlier message' },
    ],
  },
  {
    version: '1.6.1',
    date: '2025-12-24',
    changes: [
      { type: 'feature', text: 'Expanded slash commands - /h1, /h2, /h3, /bullet, /numbered, /todo, /quote, /code, /highlight' },
    ],
  },
  {
    version: '1.6.0',
    date: '2025-12-24',
    changes: [
      { type: 'feature', text: 'Demo-to-signup bridge - "Save this note" button appears after typing in demo editor' },
      { type: 'feature', text: 'Demo content migration - notes typed in demo are automatically saved after signup' },
      { type: 'feature', text: 'Enhanced empty library state with CTA button and keyboard shortcut hint' },
      { type: 'improvement', text: 'Email confirmation flow - resend email and change email options with countdown timer' },
      { type: 'improvement', text: 'Signup form polish - optional name label, password requirements hint, modal dismiss confirmation' },
      { type: 'improvement', text: 'Google OAuth now shows "Instant" badge to indicate faster signup' },
      { type: 'improvement', text: 'Mobile landing page now shows sample note card' },
      { type: 'improvement', text: 'Loading spinner added to auth submit button' },
    ],
  },
  {
    version: '1.5.0',
    date: '2025-12-23',
    changes: [
      { type: 'feature', text: 'Single note export - export individual notes as Markdown or JSON from the editor' },
      { type: 'fix', text: 'Markdown import now correctly splits combined exports into separate notes' },
      { type: 'fix', text: 'Tags are now preserved during Markdown import/export' },
      { type: 'fix', text: 'Task lists (checkboxes) are now preserved during Markdown import/export' },
      { type: 'improvement', text: 'Batch import with progress indicator - importing large numbers of notes is now much faster' },
      { type: 'improvement', text: 'Unified export format for single and bulk Markdown exports' },
    ],
  },
  {
    version: '1.4.5',
    date: '2025-12-23',
    changes: [
      { type: 'fix', text: 'Formatting toolbar now stays visible when scrolling through long notes' },
      { type: 'improvement', text: 'Toolbar moved to sticky header zone for reliable positioning' },
    ],
  },
  {
    version: '1.4.4',
    date: '2025-12-21',
    changes: [
      { type: 'improvement', text: 'Integrated editor breadcrumb - logo and note title now flow together as a connected navigation path' },
      { type: 'feature', text: 'Organic footer in editor - "Return to notes" link at end of content with Escape key hint' },
      { type: 'feature', text: 'WhisperBack floating button - appears when scrolled, positioned for easy thumb access on mobile' },
      { type: 'improvement', text: 'Save indicator moved to right actions for cleaner header layout' },
    ],
  },
  {
    version: '1.4.3',
    date: '2025-12-21',
    changes: [
      { type: 'improvement', text: 'Pixel-perfect header consistency - Logo, theme toggle, and avatar are now in the exact same position on every page' },
      { type: 'improvement', text: 'New HeaderShell component ensures uniform header structure across Library, Editor, Landing, Changelog, and Roadmap pages' },
      { type: 'improvement', text: 'Reduced code redundancy by eliminating SimpleHeader in favor of shared HeaderShell' },
    ],
  },
  {
    version: '1.4.2',
    date: '2025-12-21',
    changes: [
      { type: 'improvement', text: 'Unified header layout - theme toggle and avatar now in consistent position across all pages' },
      { type: 'improvement', text: 'Editor page now includes profile avatar with settings and sign out' },
      { type: 'improvement', text: 'Theme toggle always visible on mobile (no longer hidden in dropdown)' },
    ],
  },
  {
    version: '1.4.1',
    date: '2025-12-21',
    changes: [
      { type: 'improvement', text: 'Mobile header now fits properly without horizontal scroll' },
      { type: 'improvement', text: 'Tag filter bar with dynamic scroll fade indicators' },
      { type: 'improvement', text: 'More compact tag pills on mobile screens' },
      { type: 'fix', text: 'Prevent horizontal page overflow on mobile devices' },
    ],
  },
  {
    version: '1.4.0',
    date: '2025-12-21',
    changes: [
      { type: 'feature', text: 'Temporal chapter organization (This Week, Last Week, This Month, Earlier, Archive)' },
      { type: 'feature', text: 'Dedicated Pinned chapter for quick access to important notes' },
      { type: 'feature', text: 'Soft-delete with "Faded Notes" - recover deleted notes within 30 days' },
      { type: 'feature', text: 'TimeRibbon mobile navigation with smart auto-hide' },
      { type: 'feature', text: 'ChapterNav desktop sidebar for quick chapter jumping' },
      { type: 'improvement', text: 'Compact whisper headers for cleaner layout' },
      { type: 'improvement', text: 'Scroll-direction aware navigation (shows on scroll up)' },
    ],
  },
  {
    version: '1.3.1',
    date: '2025-12-20',
    changes: [
      { type: 'fix', text: 'Cursor position now preserved when switching browser tabs' },
    ],
  },
  {
    version: '1.3.0',
    date: '2025-12-18',
    changes: [
      { type: 'feature', text: 'Public changelog and roadmap pages' },
      { type: 'feature', text: 'Footer navigation with quick links' },
    ],
  },
  {
    version: '1.2.0',
    date: '2025-12-16',
    changes: [
      { type: 'feature', text: 'Pin notes to top of library' },
      { type: 'feature', text: 'Slash commands (/date, /time, /now, /divider)' },
      { type: 'feature', text: 'Keyboard shortcut Cmd/Ctrl+N to create new note' },
      { type: 'feature', text: 'Created/edited timestamps below note title' },
      { type: 'improvement', text: 'Sticky formatting toolbar in editor' },
      { type: 'improvement', text: 'Smart cursor focus for new vs existing notes' },
      { type: 'fix', text: 'Card text fade effect alignment' },
    ],
  },
  {
    version: '1.1.0',
    date: '2025-12-12',
    changes: [
      { type: 'feature', text: 'Landing page with interactive demo' },
      { type: 'feature', text: 'Network connectivity detection with offline alerts' },
      { type: 'feature', text: 'Toast notifications for feedback' },
      { type: 'feature', text: 'Error monitoring with Sentry integration' },
      { type: 'improvement', text: 'Code splitting for faster initial load' },
      { type: 'improvement', text: 'Mobile responsive auth modal' },
    ],
  },
  {
    version: '1.0.0',
    date: '2025-12-01',
    changes: [
      { type: 'feature', text: 'Wabi-sabi design with light and dark themes' },
      { type: 'feature', text: 'Rich text editor with formatting toolbar' },
      { type: 'feature', text: 'Tag-based organization with color picker' },
      { type: 'feature', text: 'Real-time sync across devices' },
      { type: 'feature', text: 'Google OAuth and email authentication' },
      { type: 'feature', text: 'Export to JSON and Markdown' },
      { type: 'feature', text: 'Import from backup files' },
      { type: 'feature', text: 'Search with Cmd/Ctrl+K shortcut' },
    ],
  },
];
