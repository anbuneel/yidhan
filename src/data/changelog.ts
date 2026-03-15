export type ChangeType = 'feature' | 'improvement' | 'fix';

export interface ChangelogEntry {
  version: string;
  date: string;
  changes: { type: ChangeType; text: string }[];
}

export const changelog: ChangelogEntry[] = [
  {
    version: '3.14.0',
    date: '2026-03-15',
    changes: [
      { type: 'feature', text: 'Chapter Waterline: progressive rendering shows 6 cards per chapter initially, loading more as you scroll with a washi paper-edge waterline' },
      { type: 'feature', text: 'Focused-gaze search: non-matching cards fade gracefully instead of disappearing, preserving your spatial memory of where notes live' },
      { type: 'feature', text: 'Search snippets show context around matches with highlighted keywords' },
      { type: 'fix', text: 'Search now responds to Cmd/Ctrl+K again across the library, demo, shortcuts help, and editor save-and-search handoff' },
      { type: 'improvement', text: 'Library performance: ~80% fewer DOM nodes on initial load for large libraries (100+ notes)' },
      { type: 'improvement', text: 'Rising wave entrance animation for newly loaded cards' },
    ],
  },
  {
    version: '3.13.5',
    date: '2026-03-12',
    changes: [
      { type: 'improvement', text: 'Passphrase unlock now applies a short client-side lockout after repeated failures, reducing rapid brute-force retries on shared devices' },
      { type: 'improvement', text: 'Vault key-check metadata is now versioned and bound to the user ID via AES-GCM additional authenticated data, with legacy key-checks upgrading automatically after a successful verify' },
      { type: 'improvement', text: 'Passphrase setup now shows a lightweight strength indicator and derived-key salt inputs are validated strictly at 16 bytes' },
    ],
  },
  {
    version: '3.13.4',
    date: '2026-03-12',
    changes: [
      { type: 'fix', text: 'Realtime note and tag updates now fail closed if IndexedDB persistence fails, avoiding React state drifting ahead of local storage' },
      { type: 'improvement', text: 'Sync queue processing now batches independent entities in parallel while preserving per-entity ordering' },
      { type: 'improvement', text: 'Stale sync entries now wait 24 hours before being blocked for manual retry, reducing false positives after long mobile sleep windows' },
    ],
  },
  {
    version: '3.13.3',
    date: '2026-03-12',
    changes: [
      { type: 'fix', text: 'Remembered vault sessions now include a checksum so corrupted key blobs are rejected and cleared before key import' },
      { type: 'improvement', text: 'Existing remembered-browser vault blobs now upgrade themselves to the checksummed format after a successful restore' },
    ],
  },
  {
    version: '3.13.2',
    date: '2026-03-12',
    changes: [
      { type: 'fix', text: 'Imported notes now preserve their historical chronology across devices without reusing the server sync cursor as the visible updated time' },
      { type: 'fix', text: 'Remember this browser now fails closed in both enable and disable storage-error paths, clearing persisted vault keys and avoiding misleading toggle state' },
      { type: 'improvement', text: 'Vault auto-lock, manual lock, sign-out cleanup, and remembered-browser restore paths now have explicit state-transition test coverage' },
    ],
  },
  {
    version: '3.13.1',
    date: '2026-03-11',
    changes: [
      { type: 'fix', text: 'Shared-note links now survive refresh, update prompts, and chunk-error recovery within the same browser session' },
      { type: 'fix', text: 'Hard-delete conflicts now preserve unsynced local work safely and present delete-aware recovery choices instead of misleading note-versus-note copy' },
      { type: 'fix', text: 'Direct visits and refreshes on /demo now fall back to the app shell on Vercel instead of returning 404' },
      { type: 'fix', text: 'Full backup wording now makes it explicit that share decryption keys are not included, only share metadata' },
    ],
  },
  {
    version: '3.13.0',
    date: '2026-03-10',
    changes: [
      { type: 'fix', text: 'Search now uses Cmd/Ctrl+Shift+K consistently across the app, demo, and shortcuts help, including save-and-search handoff from the editor' },
      { type: 'fix', text: 'Rendered notes now strip arbitrary classes and unsafe inline styles while preserving safe text alignment from the editor' },
      { type: 'fix', text: 'Vault session restores now verify key-check metadata before unlocking after a refresh, failing closed when stored keys are stale or corrupted' },
      { type: 'fix', text: 'Editor saves are serialized to avoid duplicate saves, false remote-update banners, and stale scroll-position writes during rapid transitions' },
    ],
  },
  {
    version: '3.12.0',
    date: '2026-03-10',
    changes: [
      { type: 'improvement', text: 'Blocked sync recovery - repeated sync failures now stay recoverable in the local queue with a manual retry action instead of being silently dropped' },
      { type: 'fix', text: 'Startup hydration no longer clears local notes, tags, or note-tag data when queued local work already exists' },
      { type: 'improvement', text: 'Encryption trust surfaces hardened - clearer unrecoverable passphrase/share-link warnings and new reliability telemetry for vault restore and decryption failures' },
    ],
  },
  {
    version: '3.11.0',
    date: '2026-03-10',
    changes: [
      { type: 'improvement', text: 'Removed swipe-left-to-delete on mobile — prevents accidental deletions, keeping the experience calm and intentional' },
    ],
  },
  {
    version: '3.10.0',
    date: '2026-03-09',
    changes: [
      { type: 'feature', text: 'Vertical sidebar toolbar — frosted glass panel with quick-access formatting on wide screens (≥1100px)' },
      { type: 'feature', text: 'Viewport-following manuscript glow — warm radial gradient that tracks your writing position' },
      { type: 'improvement', text: 'Ghost-writing placeholder — Cormorant Garamond italic, softer opacity, slower fade' },
      { type: 'improvement', text: 'Editorial blockquote — accent-colored left border with display font styling' },
      { type: 'improvement', text: 'Three-dot decorative divider (· · ·) replacing standard horizontal rules' },
      { type: 'improvement', text: 'Title zone hover-reveal — timestamps hidden by default, shown on hover or tap' },
      { type: 'improvement', text: 'Inline tag pills in editor title zone for quicker tag management' },
      { type: 'improvement', text: 'Delete dialog brand voice — "Let this note fade?" with gentler action labels' },
      { type: 'fix', text: 'Tag dropdown clicks no longer accidentally toggle timestamp visibility on mobile' },
    ],
  },
  {
    version: '3.9.1',
    date: '2026-03-07',
    changes: [
      { type: 'improvement', text: 'Sync indicator is now invisible when working — no more "N pending" flash when navigating between editor and library' },
      { type: 'improvement', text: 'Editor now shows "Saved" instead of "Synced" — honest, simple, one word' },
      { type: 'improvement', text: 'Pending sync count only appears after 30 seconds of stuck items, signaling a genuine issue rather than normal queue processing' },
    ],
  },
  {
    version: '3.9.0',
    date: '2026-03-07',
    changes: [
      { type: 'feature', text: 'New users now start with 4 starter notes and a Recipes tag — library feels alive from the first moment' },
      { type: 'feature', text: 'Landing page writing vignette — manuscript glow, ruled lines, and text that fades in line by line, showing the writing experience alongside note cards' },
      { type: 'improvement', text: 'Landing page now detects OS color preference — light-mode users see Kintsugi theme on first visit' },
      { type: 'improvement', text: 'Note cards gain a subtle aged-paper gradient (3% accent warmth at the bottom edge)' },
      { type: 'improvement', text: 'Trust signals on landing page made bolder (text-base, larger icons) for more confident first impression' },
      { type: 'improvement', text: 'Empty library state made bolder — larger title, more breathing room before first note' },
    ],
  },
  {
    version: '3.8.0',
    date: '2026-03-07',
    changes: [
      { type: 'improvement', text: 'Body font upgraded from Inter to Source Sans 3 — warmer, more distinctive typography that complements Cormorant Garamond' },
      { type: 'improvement', text: 'Removed colored top-border accent from all note cards — asymmetric wabi-sabi corners now carry the visual identity alone' },
      { type: 'improvement', text: 'Landing page CTA hierarchy refined — larger headline (4rem), bolder Start Writing button, and more visible Sign In for returning users' },
      { type: 'improvement', text: 'Mobile landing page redesigned — inline card peek replaces disconnected right panel, theme toggle and Sign In moved to header' },
      { type: 'improvement', text: 'Auth modal polished — narrower card (440px), close button moved inside, E2EE trust signal added' },
      { type: 'improvement', text: 'Welcome notes shortened to set emotional tone rather than list features — contextual discovery over upfront teaching' },
      { type: 'improvement', text: 'Chapter headers made more visible as scroll landmarks (larger text, primary color)' },
      { type: 'fix', text: 'Removed redundant backdrop-filter blur from showcase cards and auth modal (blur-on-blur with overlay)' },
      { type: 'improvement', text: 'Card backgrounds made more opaque across all themes — cards feel like card stock rather than tracing paper' },
      { type: 'improvement', text: 'Light theme card shadows strengthened with dual-layer technique for better definition on warm backgrounds' },
      { type: 'fix', text: 'Note card hover lift reduced from 6px to 3px for subtler, more paper-like interaction' },
    ],
  },
  {
    version: '3.7.0',
    date: '2026-03-06',
    changes: [
      { type: 'improvement', text: 'Shadows now use theme-aware tokens — warm terracotta tints in light mode, neutral in dark mode (6 components)' },
      { type: 'improvement', text: 'All form inputs have autoComplete hints for password managers and browser autofill (10 inputs across 5 components)' },
      { type: 'improvement', text: 'Form labels properly associated with inputs via htmlFor/id for screen reader accessibility (8 label pairs)' },
      { type: 'improvement', text: 'Card animations use smooth ease-out-quint deceleration instead of overshoot bounce' },
      { type: 'improvement', text: 'Removed unnecessary backdrop-filter blur from note cards for better scroll performance' },
      { type: 'fix', text: 'Kintsugi tertiary text contrast improved from 2.7:1 to 3.5:1 for better readability' },
      { type: 'fix', text: 'SettingsModal toggle knobs now theme-aware (were hardcoded white)' },
      { type: 'fix', text: 'Missing --color-accent-rgb CSS variable added for both light and dark themes' },
      { type: 'fix', text: 'Editor toolbar breakpoint aligned to 768px standard (was 640px)' },
    ],
  },
  {
    version: '3.6.0',
    date: '2026-03-03',
    changes: [
      { type: 'feature', text: 'Focus Mode — Ctrl+Shift+F (desktop) / triple-tap (mobile) strips editor chrome for distraction-free writing with vignette overlay and indicator pill' },
      { type: 'feature', text: 'Subtle Page Presence — elevated writing surface with "Manuscript Glow" (terracotta light / golden dark), wabi-sabi corners, and soft shadow' },
      { type: 'feature', text: 'Bottom Toolbar on Mobile — formatting tools fixed at thumb zone with heading cycle button (¶/H1/H2/H3) and upward overflow menu' },
      { type: 'improvement', text: 'Keyboard-aware toolbar positioning via Visual Viewport API (toolbar moves above virtual keyboard)' },
      { type: 'improvement', text: 'Screen reader announcements for focus mode toggle via aria-live region' },
      { type: 'improvement', text: 'Safe-area-inset-bottom support for notched devices (iPhone X+)' },
    ],
  },
  {
    version: '3.5.0',
    date: '2026-03-02',
    changes: [
      { type: 'feature', text: 'E2EE Share as Letter — share notes via encrypted capability links (per-note AES-256-GCM key in URL fragment, server never sees plaintext)' },
      { type: 'feature', text: 'New URL format: /s/<token>/<slug>#k=<key> with Vercel rewrites and security headers (no-store, no-referrer)' },
      { type: 'improvement', text: 'Soft-delete revocation model (revoked_at) replaces hard deletion for share links' },
      { type: 'improvement', text: 'Sentry replay disabled on shared note routes; URL fragments stripped from all telemetry events' },
      { type: 'improvement', text: 'Added 26 share encryption tests (base64url, token/key gen, encrypt/decrypt roundtrip, AAD binding, tamper detection)' },
    ],
  },
  {
    version: '3.4.3',
    date: '2026-03-01',
    changes: [
      { type: 'improvement', text: 'Added ~120 tests across validation, demo migration, hooks (idle timer, session timeout, vault/session settings), and components (PassphraseSetup, PassphraseUnlock, ConflictModal)' },
      { type: 'improvement', text: 'Coverage thresholds ratcheted to lines 40%, branches 35%, functions 32%, statements 38%' },
    ],
  },
  {
    version: '3.4.2',
    date: '2026-03-01',
    changes: [
      { type: 'improvement', text: 'Added ~100 unit tests covering the offline/encrypted data pipeline (encryptedNotes, offlineNotes, offlineTags, syncEngine)' },
      { type: 'improvement', text: 'Coverage thresholds ratcheted to lines 34%, branches 29%, functions 27%, statements 33%' },
      { type: 'improvement', text: 'Web Crypto polyfill centralized in shared test setup for all test files' },
    ],
  },
  {
    version: '3.4.1',
    date: '2026-03-01',
    changes: [
      { type: 'improvement', text: 'CI now enforces Vitest coverage thresholds — coverage regressions block PRs automatically' },
      { type: 'fix', text: 'Fixed 9 weak E2E assertions that could pass vacuously (broken selectors, missing assertions, conditional skips)' },
      { type: 'improvement', text: 'Coverage scoped to runtime source files for accurate reporting (~26% true baseline established)' },
    ],
  },
  {
    version: '3.4.0',
    date: '2026-02-28',
    changes: [
      { type: 'feature', text: 'Remember this browser — opt-in persistent vault unlock across browser sessions (no passphrase re-entry)' },
      { type: 'improvement', text: 'Auto-lock now clears keys from memory while preserving remembered browser state for seamless return' },
      { type: 'improvement', text: 'Restored keys verified against key-check to detect stale keys after passphrase changes' },
    ],
  },
  {
    version: '3.3.1',
    date: '2026-02-27',
    changes: [
      { type: 'improvement', text: 'Dark mode CTA buttons now use vibrant gold with dark text instead of dull olive (WCAG AAA contrast)' },
      { type: 'improvement', text: 'Checkboxes unified across editor, card previews, and forms with consistent sizing and tick marks' },
    ],
  },
  {
    version: '3.3.0',
    date: '2026-02-26',
    changes: [
      { type: 'improvement', text: 'Settings Security tab restructured with clear section headings (Encryption Vault, Session & Trust) and distinct labels' },
      { type: 'improvement', text: 'All modal backdrops now use consistent blur overlay for better visual separation' },
      { type: 'improvement', text: 'Glass border contrast increased across all four themes for crisper UI boundaries' },
      { type: 'improvement', text: 'Dark theme helper text contrast improved for better readability' },
      { type: 'fix', text: 'Removed dead E2EE migration code (MigrationPage, migrationE2EE utility) — clean slate for launch' },
      { type: 'fix', text: 'Account offboarding link moved to Profile tab only (no longer shown on Security tab)' },
    ],
  },
  {
    version: '3.2.4',
    date: '2026-02-25',
    changes: [
      { type: 'fix', text: 'Destructive buttons now meet WCAG AA contrast in all themes via new --color-destructive-text token' },
      { type: 'fix', text: 'ErrorBoundary, SharedNoteView, ChangelogPage, and RoadmapPage now use theme tokens instead of hardcoded colors' },
    ],
  },
  {
    version: '3.2.3',
    date: '2026-02-25',
    changes: [
      { type: 'fix', text: 'Unified all remaining action buttons to CTA tokens for consistent WCAG AA contrast across all themes (17 files, ~35 edits)' },
      { type: 'fix', text: 'Toggle/indicator buttons now use --color-on-accent for proper theme-adaptive text (ConflictModal, ShareModal, HeaderShell)' },
      { type: 'fix', text: 'Replaced 6+ hardcoded hex colors with theme tokens (SwipeableNoteCard gradients, checkbox checkmarks, destructive hover states)' },
    ],
  },
  {
    version: '3.2.2',
    date: '2026-02-24',
    changes: [
      { type: 'fix', text: 'E2EE migration no longer clobbers note timestamps — original updated_at preserved via RPC' },
    ],
  },
  {
    version: '3.2.1',
    date: '2026-02-24',
    changes: [
      { type: 'fix', text: 'All primary action buttons now use WCAG AA contrast-safe CTA tokens across all four themes (16 files)' },
      { type: 'fix', text: 'Account deletion "Let go" button now uses distinct destructive styling instead of CTA tokens' },
      { type: 'improvement', text: 'New --color-on-accent token for toolbar active state, adapts per theme (white in light, dark in dark)' },
    ],
  },
  {
    version: '3.2.0',
    date: '2026-02-24',
    changes: [
      { type: 'feature', text: 'Elevated landing page with 45/55 asymmetric split, staggered two-column card showcase, and entrance choreography' },
      { type: 'feature', text: 'CTA button accessibility tokens (ctaBg/ctaText) ensuring WCAG AA contrast across all four themes' },
      { type: 'improvement', text: 'Note cards now display a subtle accent border-top with color transition on hover' },
      { type: 'improvement', text: 'Landing page respects prefers-reduced-motion with animation: none override' },
      { type: 'fix', text: 'Fixed CTA button contrast ratios: Kintsugi 5.44:1, Washi 7.10:1, Midnight 4.62:1, Mori 4.72:1' },
    ],
  },
  {
    version: '3.1.0',
    date: '2026-02-23',
    changes: [
      { type: 'feature', text: 'Vault session persistence: passphrase survives page refresh (cleared on tab close)' },
      { type: 'feature', text: 'Lock vault: manually lock your encryption vault from Settings > Security' },
      { type: 'feature', text: 'Auto-lock timer: automatically lock vault after 15 or 60 minutes of inactivity' },
    ],
  },
  {
    version: '3.0.0',
    date: '2026-02-22',
    changes: [
      { type: 'feature', text: 'End-to-end encryption: note titles and content are encrypted client-side before reaching the server' },
      { type: 'feature', text: 'Passphrase setup and unlock screens for key management' },
      { type: 'feature', text: 'One-time migration to encrypt existing plaintext notes (Settings > Security)' },
      { type: 'improvement', text: 'Conflict resolution now handles encrypted notes across all three paths (keep local, keep server, keep both)' },
      { type: 'improvement', text: 'Demo-to-account migration creates encrypted notes instead of plaintext' },
      { type: 'improvement', text: 'Sentry breadcrumb scrubber strips encrypted fields before error reporting' },
      { type: 'fix', text: 'Keys properly cleared from memory on signout, preventing stale passphrase bypass' },
    ],
  },
  {
    version: '2.11.1',
    date: '2026-02-21',
    changes: [
      { type: 'fix', text: 'Shared notes ("Share as Letter") now preserve all rich text formatting (headings, lists, blockquotes, code blocks, task lists)' },
      { type: 'fix', text: 'Highlighted text (<mark>) no longer stripped from notes by HTML sanitizer' },
      { type: 'fix', text: 'Shared notes now show proper error message for network/database failures instead of misleading "faded note" message' },
    ],
  },
  {
    version: '2.11.0',
    date: '2026-02-16',
    changes: [
      { type: 'feature', text: 'Cross-device sync: edits now reach other devices in ~3 seconds (down from ~32s)' },
      { type: 'feature', text: 'Note-specific "Synced" indicator confirms when your note reaches the cloud' },
      { type: 'feature', text: 'Remote update banner: see when another device edits the same note, choose to load or keep' },
      { type: 'improvement', text: 'Pull-to-refresh now syncs with server and shows honest status feedback' },
      { type: 'improvement', text: 'Page refresh preserves your place in the editor instead of dumping to library' },
      { type: 'improvement', text: 'Auto-save debounce reduced from 1.5s to 800ms for faster save cycles' },
      { type: 'fix', text: 'Mobile app-switching no longer loses unsaved edits (visibility flush)' },
      { type: 'fix', text: 'Server timestamp standardization prevents clock-skew sync issues across devices' },
      { type: 'fix', text: 'One-time sync cursor migration fixes legacy skewed timestamps' },
    ],
  },
  {
    version: '2.10.1',
    date: '2026-02-12',
    changes: [
      { type: 'fix', text: 'Improved dark mode contrast for timestamps, icons, and tertiary text (WCAG AA compliant)' },
      { type: 'improvement', text: 'Tighter list indentation for better readability in deeply nested lists' },
    ],
  },
  {
    version: '2.10.0',
    date: '2026-01-31',
    changes: [
      { type: 'feature', text: 'Configurable session timeout (30min, 1hr, 24hr, 1 week, or never)' },
      { type: 'feature', text: '"Keep me signed in" / trusted device option extends timeout to 14 days' },
      { type: 'feature', text: 'Re-authentication required for sensitive actions (full backup, account deletion)' },
      { type: 'feature', text: 'New Security tab in Settings with timeout dropdown and trusted device toggle' },
      { type: 'improvement', text: 'Default session timeout increased from 30 minutes to 1 week' },
      { type: 'improvement', text: 'Per-user session settings stored securely in localStorage' },
    ],
  },
  {
    version: '2.9.0',
    date: '2026-01-26',
    changes: [
      { type: 'improvement', text: 'Gold caret color matches brand accent for a distinctive writing feel' },
      { type: 'improvement', text: 'Refined typography: bolder text (400 weight) and tighter line-height (1.75) for better readability' },
      { type: 'improvement', text: 'Further reduced dark mode grain for a cleaner, calmer background' },
      { type: 'improvement', text: 'Enhanced light mode with visible paper grain, warmer cards, and bolder shadows' },
      { type: 'feature', text: 'Slash command icons - visual icons for all 13 commands in the / menu' },
      { type: 'feature', text: 'Animated placeholder - rotating hints when editor is empty (every 30s)' },
      { type: 'feature', text: 'Mobile toolbar overflow menu - compact toolbar with essential tools and "more" menu' },
    ],
  },
  {
    version: '2.8.3',
    date: '2026-01-26',
    changes: [
      { type: 'fix', text: 'Avoid brief login flicker by waiting for auth state to settle before hiding the loader' },
    ],
  },
  {
    version: '2.8.2',
    date: '2026-01-25',
    changes: [
      { type: 'improvement', text: 'Reduced dark mode background grain for a calmer visual experience' },
    ],
  },
  {
    version: '2.8.1',
    date: '2026-01-22',
    changes: [
      { type: 'fix', text: 'App no longer shows loading spinner when returning from another tab' },
    ],
  },
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
      { type: 'improvement', text: 'Unified demo strategy - removed inline demo, surfaces /demo "Explore" mode' },
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
      { type: 'feature', text: 'ImpermanenceRibbon - gentle reminder that demo notes aren\'t synced to cloud' },
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
      { type: 'feature', text: 'Mobile-responsive header with compact search bar and reduced spacing' },
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
      { type: 'feature', text: 'Collapsible chapter sections with note counts and preview titles' },
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
      { type: 'feature', text: 'Card-based note library with responsive masonry grid' },
      { type: 'feature', text: 'Rich text editor with formatting toolbar' },
      { type: 'feature', text: 'Note creation, editing, and deletion with card-level actions' },
      { type: 'feature', text: 'Auto-save with debounce and "Saving..."/"Saved" indicator' },
      { type: 'feature', text: 'Tag-based organization with color picker' },
      { type: 'feature', text: 'Tag filtering bar with search integration' },
      { type: 'feature', text: 'Rich HTML preview in note cards' },
      { type: 'feature', text: 'Real-time sync across devices via Supabase' },
      { type: 'feature', text: 'Google OAuth and email authentication' },
      { type: 'feature', text: 'Password reset flow with email recovery' },
      { type: 'feature', text: 'Profile avatar with user initials' },
      { type: 'feature', text: 'Settings modal with display name, password change, and theme toggle' },
      { type: 'feature', text: 'Breadcrumb navigation in editor' },
      { type: 'feature', text: 'Export to JSON and Markdown' },
      { type: 'feature', text: 'Import from backup files' },
      { type: 'feature', text: 'Search with Cmd/Ctrl+K shortcut' },
    ],
  },
];
