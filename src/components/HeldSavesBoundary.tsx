import { Component, type ReactNode } from 'react';

interface State {
  failed: boolean;
}

/**
 * Wraps the on-demand held-save notice (issue #288). If its chunk cannot load, this
 * says so in place, and never reloads: a reload would wipe the held words, which live
 * only in memory. App prefetches the chunk when the vault opens, so this is rare.
 */
export class HeldSavesBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="fixed bottom-36 left-4 right-4 z-50 mx-auto max-w-md rounded-[var(--radius-plain)] border border-[var(--color-error)] bg-[var(--color-bg-secondary)] px-4 py-3 text-sm text-[var(--color-text-primary)]">
        Some words are not saved. Keep this page open.
      </div>
    );
  }
}
