import { useEffect, useEffectEvent, useRef } from 'react';
import { ModalBackdropButton } from './ModalBackdropButton';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Detect platform for displaying correct modifier key
const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
const modKey = isMac ? '\u2318' : 'Ctrl';

interface ShortcutItem {
  keys: string[];
  description: string;
}

interface ShortcutSection {
  title: string;
  items: ShortcutItem[];
}

const shortcuts: ShortcutSection[] = [
  {
    title: 'Global',
    items: [
      { keys: [modKey, 'K'], description: 'Focus search' },
      { keys: [modKey, 'N'], description: 'Create new note' },
      { keys: ['?'], description: 'Show this help' },
    ],
  },
  {
    title: 'Editor',
    items: [
      { keys: [modKey, 'Shift', 'F'], description: 'Toggle focus mode' },
      { keys: [modKey, 'Shift', 'C'], description: 'Copy note to clipboard' },
      { keys: ['Esc'], description: 'Exit focus mode / Save and return' },
      { keys: ['/'], description: 'Open slash commands menu' },
    ],
  },
  {
    title: 'Slash Commands',
    items: [
      { keys: ['/h1'], description: 'Large heading' },
      { keys: ['/h2'], description: 'Medium heading' },
      { keys: ['/h3'], description: 'Small heading' },
      { keys: ['/bullet'], description: 'Bullet list' },
      { keys: ['/numbered'], description: 'Numbered list' },
      { keys: ['/todo'], description: 'Task checklist' },
      { keys: ['/quote'], description: 'Block quote' },
      { keys: ['/code'], description: 'Code block' },
      { keys: ['/highlight'], description: 'Highlight text' },
      { keys: ['/divider'], description: 'Horizontal line' },
      { keys: ['/date'], description: "Insert today's date" },
      { keys: ['/time'], description: 'Insert current time' },
      { keys: ['/now'], description: 'Insert date and time' },
    ],
  },
  {
    title: 'Mobile Gestures',
    items: [
      { keys: ['Swipe right'], description: 'Pin/unpin note' },
      { keys: ['Pull down'], description: 'Refresh notes' },
      { keys: ['Triple-tap'], description: 'Toggle focus mode' },
    ],
  },
];

/**
 * Modal showing all keyboard shortcuts, slash commands, and mobile gestures.
 *
 * Uses wabi-sabi styling with calm "Quiet Shortcuts" title.
 * Platform-aware: shows the macOS command symbol on Mac, Ctrl on Windows/Linux.
 */
export function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  const modalRef = useRef<HTMLDialogElement>(null);
  const handleEscapeKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  });

  // Handle Escape key to close
  useEffect(() => {
    if (!isOpen) return;

    window.addEventListener('keydown', handleEscapeKey);
    return () => window.removeEventListener('keydown', handleEscapeKey);
  }, [isOpen]);

  // Focus modal on open for accessibility
  useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 modal-backdrop"
    >
      <ModalBackdropButton label="Close keyboard shortcuts" onClick={onClose} />
      <dialog
        open
        ref={modalRef}
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        className="
          relative z-10 w-full max-w-lg max-h-[80vh] overflow-y-auto
          shadow-2xl
          animate-[modal-enter_300ms_ease-out]
          p-0 border-0
        "
        style={{
          background: 'var(--color-bg-primary)',
          borderRadius: 'var(--radius-card)',
          border: '1px solid var(--glass-border)',
          margin: 0,
        }}
      >
        {/* Header */}
        <div
          className="px-6 py-5 border-b sticky top-0"
          style={{
            borderColor: 'var(--glass-border)',
            background: 'var(--color-bg-primary)',
          }}
        >
          <div className="flex items-center justify-between">
            <h2
              id="shortcuts-title"
              className="text-xl italic"
              style={{
                fontFamily: 'var(--font-display)',
                color: 'var(--color-text-primary)',
              }}
            >
              Quiet Shortcuts
            </h2>
            <button type="button"
              onClick={onClose}
              className="
                size-8
                flex items-center justify-center
                rounded-full
                transition-colors duration-200
              "
              style={{ color: 'var(--color-text-tertiary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--color-bg-secondary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
              aria-label="Close"
            >
              <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {shortcuts.map((section, sectionIndex) => (
            <div key={section.title} className={sectionIndex > 0 ? 'mt-5' : ''}>
              <h3
                className="text-xs font-medium uppercase tracking-wider mb-3"
                style={{
                  fontFamily: 'var(--font-body)',
                  color: 'var(--color-text-tertiary)',
                }}
              >
                {section.title}
              </h3>
              <div className="space-y-2">
                {section.items.map((item) => (
                  <div
                    key={`${section.title}-${item.description}`}
                    className="flex items-center justify-between py-1"
                  >
                    <span
                      className="text-sm"
                      style={{
                        fontFamily: 'var(--font-body)',
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      {item.description}
                    </span>
                    <div className="flex items-center gap-1">
                      {item.keys.map((key) => (
                        <kbd
                          key={`${item.description}-${key}`}
                          className="px-2 py-1 text-xs rounded"
                          style={{
                            fontFamily: 'var(--font-body)',
                            background: 'var(--color-bg-secondary)',
                            color: 'var(--color-text-primary)',
                            border: '1px solid var(--glass-border)',
                          }}
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Footer hint */}
          <p
            className="mt-6 text-center text-xs"
            style={{
              fontFamily: 'var(--font-body)',
              color: 'var(--color-text-tertiary)',
            }}
          >
            Press <kbd
              className="px-1.5 py-0.5 rounded mx-1"
              style={{
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--glass-border)',
              }}
            >Esc</kbd> or click outside to close
          </p>
        </div>
      </dialog>
    </div>
  );
}
