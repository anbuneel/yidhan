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
  it('does not mask a one-line preview', async () => {
    const { container, rerenderCard } = renderPreviewCard('<p>One clear line.</p>');
    const preview = container.querySelector<HTMLElement>('.note-card-preview');
    if (!preview) throw new Error('Full card preview was not rendered');

    setPreviewHeight(preview, 24, 24);
    rerenderCard('<p>One clear line, updated.</p>');

    await waitFor(() => expect(preview).not.toHaveClass('note-card-preview-overflowing'));
  });

  it('does not mask a preview exactly at the overflow boundary', async () => {
    const { container, rerenderCard } = renderPreviewCard('<p>Boundary preview.</p>');
    const preview = container.querySelector<HTMLElement>('.note-card-preview');
    if (!preview) throw new Error('Full card preview was not rendered');

    setPreviewHeight(preview, 128, 128);
    rerenderCard('<p>Boundary preview, updated.</p>');

    await waitFor(() => expect(preview).not.toHaveClass('note-card-preview-overflowing'));
  });

  it('masks overflowing full previews but keeps compact cards on their truncation path', async () => {
    const { container, rerenderCard } = renderPreviewCard('<p>Long preview.</p>');
    const preview = container.querySelector<HTMLElement>('.note-card-preview');
    if (!preview) throw new Error('Full card preview was not rendered');

    setPreviewHeight(preview, 128, 129);
    rerenderCard('<p>Long preview with another clipped line.</p>');
    await waitFor(() => expect(preview).toHaveClass('note-card-preview-overflowing'));

    rerenderCard('<p>Long preview with another clipped line.</p>', true);
    expect(container.querySelector('.note-card-preview')).toBeNull();
    expect(container.querySelector('.note-card-preview-overflowing')).toBeNull();
  });

  it('shares one ResizeObserver across many full cards and skips observing compact cards (C4)', async () => {
    const observerSpy = vi.spyOn(window, 'ResizeObserver');

    const compactRender = render(
      <NoteCard note={createMockNote({ id: 'compact-1' })} onClick={vi.fn()} onDelete={vi.fn()} onTogglePin={vi.fn()} isCompact />
    );
    expect(observerSpy).not.toHaveBeenCalled();
    compactRender.unmount();

    const fullRender = render(
      <>
        <NoteCard note={createMockNote({ id: 'full-1' })} onClick={vi.fn()} onDelete={vi.fn()} onTogglePin={vi.fn()} />
        <NoteCard note={createMockNote({ id: 'full-2' })} onClick={vi.fn()} onDelete={vi.fn()} onTogglePin={vi.fn()} />
        <NoteCard note={createMockNote({ id: 'full-3' })} onClick={vi.fn()} onDelete={vi.fn()} onTogglePin={vi.fn()} />
      </>
    );

    expect(observerSpy).toHaveBeenCalledTimes(1);
    const sharedInstance = observerSpy.mock.results[0].value as { observe: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> };
    expect(sharedInstance.observe).toHaveBeenCalledTimes(3);

    fullRender.unmount();
    expect(sharedInstance.disconnect).toHaveBeenCalledTimes(1);

    // Remount after all cards unmounted must create a clean observer and detect overflow.
    const remount = render(
      <NoteCard note={createMockNote({ id: 'full-4' })} onClick={vi.fn()} onDelete={vi.fn()} onTogglePin={vi.fn()} />
    );
    expect(observerSpy).toHaveBeenCalledTimes(2);
    const preview = remount.container.querySelector<HTMLElement>('.note-card-preview')!;
    setPreviewHeight(preview, 128, 200);
    remount.rerender(
      <NoteCard note={createMockNote({ id: 'full-4', content: '<p>Updated overflow</p>' })} onClick={vi.fn()} onDelete={vi.fn()} onTogglePin={vi.fn()} />
    );
    await waitFor(() => expect(preview).toHaveClass('note-card-preview-overflowing'));
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

describe('NoteCard preview block truncation (C3)', () => {
  it('does not truncate short notes and preserves their full visible text', () => {
    const htmlSpy = vi.spyOn(sanitize, 'sanitizeHtml');
    const content = '<p>First line with <strong>bold</strong>.</p><p>Second line.</p>';
    const note = createMockNote({ id: 'c3-short', content });

    const { container } = render(
      <NoteCard note={note} onClick={vi.fn()} onDelete={vi.fn()} onTogglePin={vi.fn()} />
    );

    expect(htmlSpy).toHaveBeenCalledWith(content);
    expect(container.querySelector('.note-card-preview')).toHaveTextContent('First line with bold.Second line.');
  });

  it('truncates a long multi-block note on block boundaries before sanitising', () => {
    const htmlSpy = vi.spyOn(sanitize, 'sanitizeHtml');
    const blocks = Array.from({ length: 40 }, (_, i) => `<p>Paragraph ${i + 1}: steady writing across the page.</p>`);
    const content = blocks.join('');
    const note = createMockNote({ id: 'c3-long', content });

    const { container } = render(
      <NoteCard note={note} onClick={vi.fn()} onDelete={vi.fn()} onTogglePin={vi.fn()} />
    );

    expect(htmlSpy).toHaveBeenCalledTimes(1);
    const passedToSanitize = htmlSpy.mock.calls[0][0];
    expect(passedToSanitize.length).toBeLessThan(content.length / 2);
    expect(passedToSanitize.endsWith('</p>')).toBe(true);
    expect(passedToSanitize).not.toContain('Paragraph 40');
    expect(container.querySelector('.note-card-preview')).toHaveTextContent('Paragraph 1');
    expect(container.querySelector('.note-card-preview')).not.toHaveTextContent('Paragraph 40');
  });

  it('closes open list tags when truncating a long task list before sanitising', () => {
    const htmlSpy = vi.spyOn(sanitize, 'sanitizeHtml');
    const items = Array.from(
      { length: 25 },
      (_, i) =>
        `<li data-checked="${i % 2 === 0 ? 'true' : 'false'}" data-type="taskItem"><label><input type="checkbox" ${i % 2 === 0 ? 'checked="checked"' : ''}><span></span></label><div><p>Task item ${i + 1}</p></div></li>`
    ).join('');
    const content = `<ul data-type="taskList">${items}</ul>`;
    const note = createMockNote({ id: 'c3-tasks', content });

    const { container } = render(
      <NoteCard note={note} onClick={vi.fn()} onDelete={vi.fn()} onTogglePin={vi.fn()} />
    );

    const passedToSanitize = htmlSpy.mock.calls[0][0];
    expect(passedToSanitize.endsWith('</ul>')).toBe(true);
    expect(passedToSanitize).not.toContain('Task item 25');
    expect(container.querySelectorAll('.note-card-preview li').length).toBe(8);
  });

  it('bounds a single giant paragraph and still sanitises dangerous markup', () => {
    const htmlSpy = vi.spyOn(sanitize, 'sanitizeHtml');
    const words = Array.from({ length: 600 }, (_, i) => `word${i}`).join(' ');
    const content = `<p><script>alert(1)</script>${words}</p>`;
    const note = createMockNote({ id: 'c3-giant', content });

    const { container } = render(
      <NoteCard note={note} onClick={vi.fn()} onDelete={vi.fn()} onTogglePin={vi.fn()} />
    );

    const passedToSanitize = htmlSpy.mock.calls[0][0];
    expect(passedToSanitize.length).toBeLessThan(content.length / 2);
    expect(passedToSanitize.endsWith('</p>')).toBe(true);
    expect(container.querySelector('.note-card-preview script')).toBeNull();
    expect(container.querySelector('.note-card-preview')).toHaveTextContent('word0');
  });

  it('does not truncate before search snippet matching so deep matches still highlight', () => {
    const filler = Array.from({ length: 30 }, (_, i) => `<p>Filler paragraph ${i + 1} with ordinary words.</p>`).join('');
    const note = createMockNote({
      id: 'c3-deep-search',
      title: 'Long note',
      content: `${filler}<p>Hidden needle near the end.</p>`,
    });

    const { container } = render(
      <NoteCard
        note={note}
        onClick={vi.fn()}
        onDelete={vi.fn()}
        onTogglePin={vi.fn()}
        searchQuery="needle"
      />
    );

    expect(container.querySelector('.search-snippet mark')).toHaveTextContent('needle');
  });
});
