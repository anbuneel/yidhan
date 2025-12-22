export type ChangeType = 'feature' | 'improvement' | 'fix';

export interface ChangelogEntry {
  version: string;
  date: string;
  changes: { type: ChangeType; text: string }[];
}

export const changelog: ChangelogEntry[] = [
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
