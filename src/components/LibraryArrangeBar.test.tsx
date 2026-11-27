import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LibraryArrangeBar } from './LibraryArrangeBar';

function renderBar() {
  const onBasisChange = vi.fn();
  const onSortChange = vi.fn();
  render(
    <LibraryArrangeBar
      arrangement={{ basis: 'updated', sort: 'title' }}
      onBasisChange={onBasisChange}
      onSortChange={onSortChange}
    />
  );
  return { onBasisChange, onSortChange };
}

describe('LibraryArrangeBar', () => {
  it('underlines the active option in plain text, with no chip fill, border or pill', () => {
    renderBar();
    const active = screen.getByRole('button', { name: 'Order notes by title' });
    expect(active).toHaveAttribute('aria-pressed', 'true');
    expect(active).toHaveStyle({ textDecorationLine: 'underline', color: 'var(--color-accent-text)' });
    expect(active.style.background).toBe('');
    expect(active.style.border).toBe('');
    expect(active.style.borderRadius).toBe('');
    expect(active.className).not.toMatch(/rounded-(full|lg)/);
  });

  it('does not underline the inactive options', () => {
    renderBar();
    for (const name of ['Order notes by edited', 'Order notes by written', 'Group chapters by written']) {
      const option = screen.getByRole('button', { name });
      expect(option).toHaveAttribute('aria-pressed', 'false');
      expect(option).toHaveStyle({ textDecorationLine: 'none' });
    }
  });

  it('still changes the arrangement', async () => {
    const user = userEvent.setup({ delay: null });
    const { onBasisChange, onSortChange } = renderBar();
    await user.click(screen.getByRole('button', { name: 'Group chapters by written' }));
    expect(onBasisChange).toHaveBeenCalledWith('created');
    expect(onSortChange).not.toHaveBeenCalled();
  });
});
