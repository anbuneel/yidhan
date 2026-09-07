import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';

interface LinkPopoverProps {
  editor: Editor;
  onClose: () => void;
}

export function LinkPopover({ editor, onClose }: LinkPopoverProps) {
  const [selection] = useState(() => ({ from: editor.state.selection.from, to: editor.state.selection.to }));
  const [href, setHref] = useState(() => String(editor.getAttributes('link').href ?? ''));
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLFormElement>(null);
  const [hadLink] = useState(() => editor.isActive('link'));

  useEffect(() => {
    input.current?.focus();
    input.current?.select();
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        editor.commands.focus();
      }
    };
    const outside = (event: MouseEvent) => {
      if (!panel.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener('keydown', dismiss, true);
    document.addEventListener('mousedown', outside);
    return () => {
      document.removeEventListener('keydown', dismiss, true);
      document.removeEventListener('mousedown', outside);
    };
  }, [editor, onClose]);

  let visitAddress: string | undefined;
  try {
    const url = new URL(href.trim());
    if (['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol)) visitAddress = url.href;
  } catch { /* Incomplete addresses are not navigable. */ }

  const save = () => {
    // Store the parsed address, not the raw input, so the value that was vetted
    // is the value that lands in the note.
    let address: string;
    try {
      const url = new URL(href.trim());
      if (!['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol)) throw new Error('Unsupported address');
      address = url.href;
    } catch {
      setError('Enter a full web address, email link, or phone link.');
      return;
    }
    const chain = editor.chain().focus().setTextSelection(selection);
    if (selection.from === selection.to && !hadLink) {
      chain.insertContent({ type: 'text', text: address, marks: [{ type: 'link', attrs: { href: address } }] }).run();
    } else {
      chain.extendMarkRange('link').setLink({ href: address }).run();
    }
    onClose();
  };

  return (
    <form ref={panel} role="dialog" aria-label="Edit link" data-editor-popover="link"
      className="fixed inset-x-4 top-24 z-50 mx-auto max-w-sm rounded-[2px_12px_4px_12px] border border-[var(--glass-border)] bg-[var(--color-bg-secondary)] p-4 text-[var(--color-text-primary)]"
      onSubmit={event => { event.preventDefault(); save(); }}>
      <label htmlFor="editor-link-address" className="mb-2 block text-sm">Link address</label>
      <input ref={input} id="editor-link-address" type="text" inputMode="url" value={href}
        onChange={event => { setHref(event.target.value); setError(''); }}
        aria-invalid={!!error} aria-describedby={error ? 'editor-link-error' : undefined}
        className="w-full rounded border border-[var(--glass-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-base"
        placeholder="https://example.com" />
      {error && <p id="editor-link-error" role="alert" className="mt-2 text-sm text-[var(--color-error)]">{error}</p>}
      {hadLink && visitAddress && <a href={visitAddress} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm underline">Open link</a>}
      <div className="mt-4 flex items-center justify-end gap-3 text-sm">
        {hadLink && <button type="button" className="mr-auto text-[var(--color-text-secondary)]" onClick={() => {
          editor.chain().focus().setTextSelection(selection).extendMarkRange('link').unsetLink().run();
          onClose();
        }}>Remove link</button>}
        <button type="button" onClick={() => { onClose(); editor.commands.focus(); }}>Cancel</button>
        <button type="submit" className="rounded bg-[var(--color-cta-bg)] px-3 py-2 text-[var(--color-cta-text)]">Save link</button>
      </div>
    </form>
  );
}
