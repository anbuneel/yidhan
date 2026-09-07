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
