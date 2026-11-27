import { Component, type ReactNode } from 'react';
import { heldSaves } from '../stores/heldSaves';

interface Props {
  children: ReactNode;
  onLockAnyway: () => void;
}

interface State {
  failed: boolean;
  copied?: boolean;
}

/**
 * Wraps the on-demand held-save notice (issue #288). If its chunk cannot load, this
 * stands in for it and never reloads: a reload would wipe the held words, which live
 * only in memory. It still offers a plain Copy of every held note and Lock anyway, so
 * the words can be taken out and the vault can be locked. App prefetches the chunk when
 * the vault opens, so this is rare.
 */
export class HeldSavesBoundary extends Component<Props, State> {
  state: State = { failed: false };

  copy = async () => {
    const text = heldSaves.getSnapshot()
      .map((e) => `${e.title}\n\n${e.content.replace(/<[^>]*>/g, ' ')}`)
      .join('\n\n');
    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch { /* shown below */ }
    this.setState({ copied });
  };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const { copied } = this.state;
    return (
      <div role="alert" className="fixed bottom-36 left-4 right-4 z-50 mx-auto flex max-w-md flex-wrap gap-3 rounded-[var(--radius-plain)] border border-[var(--color-error)] bg-[var(--color-bg-secondary)] px-4 py-3 text-sm">
        <span className="basis-full">
          Some words are not saved.{copied === true && ' Copied.'}{copied === false && ' Could not copy.'}
        </span>
        <button type="button" onClick={() => { void this.copy(); }}>Copy</button>
        <button type="button" onClick={this.props.onLockAnyway}>Lock anyway</button>
      </div>
    );
  }
}
