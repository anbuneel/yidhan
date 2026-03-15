import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';

describe('KeyboardShortcutsModal', () => {
  it('shows Cmd/Ctrl+K for search', () => {
    render(<KeyboardShortcutsModal isOpen onClose={vi.fn()} />);

    const searchRow = screen.getByText('Focus search').closest('div');
    expect(searchRow).not.toBeNull();

    const expectedModifier = navigator.platform.toUpperCase().includes('MAC') ? '\u2318' : 'Ctrl';
    const row = within(searchRow as HTMLElement);
    expect(row.getByText(expectedModifier)).toBeInTheDocument();
    expect(row.getByText('K')).toBeInTheDocument();
    expect(row.queryByText('Shift')).not.toBeInTheDocument();
  });
});
