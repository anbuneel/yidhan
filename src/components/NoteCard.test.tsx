import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createMockNote } from '../test/factories';
import type { NoteDeleteHandler } from '../types';
import * as sanitize from '../utils/sanitize';
import { NoteCard } from './NoteCard';

function setPreviewHeight(preview: HTMLElement, clientHeight: number, scrollHeight: number) {
  Object.defineProperties(preview, {
    clientHeight: { configurable: true, value: clientHeight },
    scrollHeight: { configurable: true, value: scrollHeight },
  });
}

function renderPreviewCard(content: string, isCompact = false) {
  const note = createMockNote({ id: 'preview-note', content });
  const onClick = vi.fn();
  const onDelete = vi.fn();
  const onTogglePin = vi.fn();
  const rendered = render(
    <NoteCard
      note={note}
      onClick={onClick}
      onDelete={onDelete}
      onTogglePin={onTogglePin}
      isCompact={isCompact}
    />
  );

  const rerenderCard = (nextContent: string, nextIsCompact = isCompact) => {
    rendered.rerender(
      <NoteCard
        note={{ ...note, content: nextContent }}
        onClick={onClick}
        onDelete={onDelete}
        onTogglePin={onTogglePin}
        isCompact={nextIsCompact}
      />
    );
  };

  return { ...rendered, rerenderCard };
}

function renderCard(onDelete: NoteDeleteHandler) {
  const note = createMockNote({ id: 'note-to-fade', title: 'A passing thought' });
  const rendered = render(
    <NoteCard
      note={note}
      onClick={vi.fn()}
      onDelete={onDelete}
      onTogglePin={vi.fn()}
    />
  );
  const card = screen.getByRole('button', { name: /Open note/ }).closest('.note-card');
  if (!card) throw new Error('Note card was not rendered');
  return { ...rendered, card, note };
}

describe('NoteCard deletion', () => {
  it('still deletes exactly once when search unmounts the card mid-animation', async () => {
    const onDelete = vi.fn().mockResolvedValue(true);
    const user = userEvent.setup({ delay: null });
    const { unmount } = renderCard(onDelete);

    await user.click(screen.getByRole('button', { name: 'Delete note' }));
    unmount();

    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1));
    expect(onDelete).toHaveBeenCalledWith('note-to-fade');
  });

  it('does not repeat deletion when animation completion is followed by unmount', async () => {
    const onDelete = vi.fn().mockResolvedValue(true);
    const user = userEvent.setup({ delay: null });
    const { card, unmount } = renderCard(onDelete);

    await user.click(screen.getByRole('button', { name: 'Delete note' }));
    fireEvent.animationEnd(card);
    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1));
    unmount();

    await Promise.resolve();
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('restores the card and explains a rejected delete', async () => {
    const onDelete = vi.fn().mockRejectedValue(new Error('IndexedDB write failed'));
    const user = userEvent.setup({ delay: null });
    const { card } = renderCard(onDelete);

    await user.click(screen.getByRole('button', { name: 'Delete note' }));
    expect(card).toHaveClass('deleting');
    fireEvent.animationEnd(card);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This note could not be faded. Try again.'
    );
    expect(card).not.toHaveClass('deleting');
    expect(screen.getByRole('button', { name: 'Delete note' })).toBeEnabled();
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('restores the card with one inline message when deletion returns false', async () => {
    const onDelete = vi.fn().mockResolvedValue(false);
    const user = userEvent.setup({ delay: null });
    const { card } = renderCard(onDelete);

    await user.click(screen.getByRole('button', { name: 'Delete note' }));
    fireEvent.animationEnd(card);

    expect(await screen.findAllByRole('alert')).toHaveLength(1);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'This note could not be faded. Try again.'
    );
    expect(card).not.toHaveClass('deleting');
    expect(screen.getByRole('button', { name: 'Delete note' })).toBeEnabled();
  });
});

describe('NoteCard delete button on compact cards', () => {
  it('renders delete on compact cards, visible only on touch screens', () => {
    renderPreviewCard('Short', true);
    const del = screen.getByRole('button', { name: 'Delete note' });
    expect(del.className).toMatch(/(^|\s)hidden(\s|$)/);
    expect(del.className).toMatch(/\[@media\(hover:none\)\]:flex/);
    expect(del.className).toMatch(/\[@media\(any-pointer:coarse\)\]:flex/);
  });

  it('does not hide delete on full cards', () => {
    renderPreviewCard('Short', false);
    const del = screen.getByRole('button', { name: 'Delete note' });
    expect(del.className).not.toMatch(/(^|\s)hidden(\s|$)/);
    expect(del.className).toMatch(/(^|\s)flex(\s|$)/);
  });

  it('does not render delete on decorative cards', () => {
    render(
      <NoteCard note={createMockNote()} onClick={vi.fn()} onDelete={vi.fn()} onTogglePin={vi.fn()} isCompact isDecorative />
    );
    expect(screen.queryByRole('button', { name: 'Delete note' })).toBeNull();
  });
});

describe('NoteCard preview mask', () => {
  it('does not mask a one-line preview', () => {
    const { container, rerenderCard } = renderPreviewCard('<p>One clear line.</p>');
    const preview = container.querySelector<HTMLElement>('.note-card-preview');
    if (!preview) throw new Error('Full card preview was not rendered');

    setPreviewHeight(preview, 24, 24);
    rerenderCard('<p>One clear line, updated.</p>');

    expect(preview).not.toHaveClass('note-card-preview-overflowing');
  });

  it('does not mask a preview exactly at the overflow boundary', () => {
    const { container, rerenderCard } = renderPreviewCard('<p>Boundary preview.</p>');
    const preview = container.querySelector<HTMLElement>('.note-card-preview');
    if (!preview) throw new Error('Full card preview was not rendered');

    setPreviewHeight(preview, 128, 128);
    rerenderCard('<p>Boundary preview, updated.</p>');

    expect(preview).not.toHaveClass('note-card-preview-overflowing');
  });

  it('masks overflowing full previews but keeps compact cards on their truncation path', () => {
    const { container, rerenderCard } = renderPreviewCard('<p>Long preview.</p>');
    const preview = container.querySelector<HTMLElement>('.note-card-preview');
    if (!preview) throw new Error('Full card preview was not rendered');

    setPreviewHeight(preview, 128, 129);
    rerenderCard('<p>Long preview with another clipped line.</p>');
    expect(preview).toHaveClass('note-card-preview-overflowing');

    rerenderCard('<p>Long preview with another clipped line.</p>', true);
    expect(container.querySelector('.note-card-preview')).toBeNull();
    expect(container.querySelector('.note-card-preview-overflowing')).toBeNull();
  });
});

describe('NoteCard search highlighting', () => {
  it('highlights every free-text match while leaving operators out of the highlight', () => {
    const note = createMockNote({
      id: 'search-result',
      title: 'Alpha alpha',
      content: '<p>Beta beta and alpha.</p>',
    });
    const { container } = render(
      <NoteCard
        note={note}
        onClick={vi.fn()}
        onDelete={vi.fn()}
        onTogglePin={vi.fn()}
        searchQuery="tag:journal alpha beta"
      />
    );

    expect([...container.querySelectorAll('mark')].map((mark) => mark.textContent))
      .toEqual(['Alpha', 'alpha', 'Beta', 'beta', 'alpha']);
    expect(container.querySelector('mark')?.closest('.note-card')).not.toHaveTextContent(
      'tag:journal'
    );
  });

  it('highlights the indexed word and builds a snippet for a fuzzy content match', () => {
    const note = createMockNote({
      id: 'fuzzy-result',
      title: 'Autumn plans',
      content: '<p>A long introduction before the orchard harvest begins.</p>',
    });
    const { container } = render(
      <NoteCard
        note={note}
        onClick={vi.fn()}
        onDelete={vi.fn()}
        onTogglePin={vi.fn()}
        searchQuery="harvst"
        searchMatchTerms={['harvest']}
      />
    );

    expect(container.querySelector('mark')).toHaveTextContent('harvest');
    expect(container.querySelector('.search-snippet')).toHaveTextContent('orchard harvest');
  });
});

describe('NoteCard sanitization per render mode (C2)', () => {
  it('does not run htmlToPlainText on a full card outside search, and still sanitises HTML', () => {
    const plainSpy = vi.spyOn(sanitize, 'htmlToPlainText');
    const htmlSpy = vi.spyOn(sanitize, 'sanitizeHtml');
    const note = createMockNote({
      id: 'c2-full',
      title: 'Safe title',
      content: '<p>Visible <strong>text</strong></p><script>window.__xss=1</script><img src="x" onerror="alert(1)" />',
    });

    const { container } = render(
      <NoteCard note={note} onClick={vi.fn()} onDelete={vi.fn()} onTogglePin={vi.fn()} />
    );

    expect(plainSpy).not.toHaveBeenCalled();
    expect(htmlSpy).toHaveBeenCalledTimes(1);
    const preview = container.querySelector('.note-card-preview');
    expect(preview).toHaveTextContent('Visible text');
    expect(preview?.querySelector('script')).toBeNull();
    expect(preview?.querySelector('img')).toBeNull();
  });

  it('does not run sanitizeHtml on a compact card outside search', () => {
    const plainSpy = vi.spyOn(sanitize, 'htmlToPlainText');
    const htmlSpy = vi.spyOn(sanitize, 'sanitizeHtml');
    const note = createMockNote({
      id: 'c2-compact',
      content: '<p>Compact <em>preview</em> text</p>',
    });

    render(
      <NoteCard note={note} onClick={vi.fn()} onDelete={vi.fn()} onTogglePin={vi.fn()} isCompact />
    );

    expect(htmlSpy).not.toHaveBeenCalled();
    expect(plainSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Compact preview text')).toBeInTheDocument();
  });

  it('does not run sanitizeHtml when a search card renders a content snippet', () => {
    const htmlSpy = vi.spyOn(sanitize, 'sanitizeHtml');
    const note = createMockNote({
      id: 'c2-search',
      title: 'Notes',
      content: '<p>Found the <strong>lantern</strong> in the shed.</p>',
    });

    const { container } = render(
      <NoteCard
        note={note}
        onClick={vi.fn()}
        onDelete={vi.fn()}
        onTogglePin={vi.fn()}
        searchQuery="lantern"
      />
    );

    expect(htmlSpy).not.toHaveBeenCalled();
    expect(container.querySelector('.search-snippet mark')).toHaveTextContent('lantern');
  });

  it('falls back to sanitized HTML when search matches only the title on a full card', () => {
    const htmlSpy = vi.spyOn(sanitize, 'sanitizeHtml');
    const note = createMockNote({
      id: 'c2-title-only',
      title: 'Lantern notes',
      content: '<p>Body without that word.</p>',
    });

    const { container } = render(
      <NoteCard
        note={note}
        onClick={vi.fn()}
        onDelete={vi.fn()}
        onTogglePin={vi.fn()}
        searchQuery="lantern"
      />
    );

    expect(htmlSpy).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.note-card-preview')).toHaveTextContent('Body without that word.');
  });
});
