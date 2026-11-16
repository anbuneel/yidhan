import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { TagSelector } from './TagSelector';
it('closes the tag picker on Escape and consumes the event before editor exit', () => {
  render(<TagSelector tags={[]} selectedTagIds={[]} variant="inline" onToggleTag={vi.fn()} />);
  const trigger = screen.getByRole('button', { name: 'Add tag' });
  fireEvent.click(trigger);
  expect(screen.getByText('No tags yet')).toBeVisible();
  const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  fireEvent(document, event);
  expect(event.defaultPrevented).toBe(true);
  expect(screen.queryByText('No tags yet')).toBeNull();
  expect(trigger).toHaveFocus();
});

const colouredTags = [
  { id: 'a', name: 'Journal', color: 'terracotta' as const, createdAt: new Date() },
  { id: 'b', name: 'Ideas', color: 'gold' as const, createdAt: new Date() },
];

it('lists tags without stored colours and marks the selected one', () => {
  const { container } = render(
    <TagSelector tags={colouredTags} selectedTagIds={['b']} variant="inline" onToggleTag={vi.fn()} />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Add tag' }));
  expect(screen.getByRole('button', { name: 'Ideas', pressed: true })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Journal', pressed: false })).toBeInTheDocument();
  const html = container.innerHTML.toLowerCase();
  expect(html).not.toContain('#b5643f');
  expect(html).not.toContain('#9c7a26');
});

it('shows selected tags as plain upright words, not tinted chips', () => {
  render(<TagSelector tags={colouredTags} selectedTagIds={['a', 'b']} onToggleTag={vi.fn()} />);
  const journal = screen.getByText('Journal');
  expect(journal.closest('.italic')).toBeNull();
  expect(journal.closest('[style*="background"]')).toBeNull();
});

it('toggles only the tag that was clicked', () => {
  const onToggleTag = vi.fn();
  render(<TagSelector tags={colouredTags} selectedTagIds={[]} variant="inline" onToggleTag={onToggleTag} />);
  fireEvent.click(screen.getByRole('button', { name: 'Add tag' }));
  fireEvent.click(screen.getByRole('button', { name: 'Journal' }));
  expect(onToggleTag).toHaveBeenCalledTimes(1);
  expect(onToggleTag).toHaveBeenCalledWith('a');
});
