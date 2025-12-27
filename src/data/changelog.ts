export type ChangeType = 'feature' | 'improvement' | 'fix';

export interface ChangelogEntry {
  version: string;
  date: string;
  changes: { type: ChangeType; text: string }[];
}

export const changelog: ChangelogEntry[] = [
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
      { type: 'feature', text: 'PWA support - install Zenote to your home screen for app-like experience' },
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
