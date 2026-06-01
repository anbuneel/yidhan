import { useState, type ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Header } from './Header';

vi.mock('./HeaderShell', () => ({
  HeaderShell: ({
    center,
    rightActions,
  }: {
    center?: ReactNode;
    rightActions?: ReactNode;
  }) => (
    <div>
      <div data-testid="header-center">{center}</div>
      <div data-testid="header-right">{rightActions}</div>
    </div>
  ),
}));

vi.mock('./SyncIndicator', () => ({
  SyncIndicator: () => <div data-testid="sync-indicator" />,
}));

describe('Header', () => {
  const defaultProps = {
    theme: 'dark' as const,
    onThemeToggle: vi.fn(),
    onNewNote: vi.fn(),
    searchFocusToken: 0,
    searchQuery: '',
    onSearchChange: vi.fn(),
    onExportJSON: vi.fn(),
    onExportMarkdown: vi.fn(),
    onImportFile: vi.fn(),
    onSettingsClick: vi.fn(),
    onFadedNotesClick: vi.fn(),
    fadedNotesCount: 0,
  };

  it('shows the updated search shortcut hint', () => {
    render(<Header {...defaultProps} />);

    const expectedShortcut = navigator.platform.toUpperCase().includes('MAC') ? '\u2318K' : 'Ctrl+K';
    expect(screen.getByText(expectedShortcut)).toBeInTheDocument();
  });

  it('focuses search when the focus token changes', async () => {
    const { rerender } = render(<Header {...defaultProps} />);

    rerender(<Header {...defaultProps} searchFocusToken={101} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search your thoughts...')).toHaveFocus();
    });
  });

  it('does not replay an old focus request after remount', async () => {
    const user = userEvent.setup();

    function Harness() {
      const [searchFocusToken, setSearchFocusToken] = useState(0);
      const [showHeader, setShowHeader] = useState(true);

      return (
        <>
          <button type="button" onClick={() => setSearchFocusToken((prev) => prev + 1000)}>Request focus</button>
          <button type="button" onClick={() => setShowHeader((prev) => !prev)}>Toggle header</button>
          {showHeader ? <Header {...defaultProps} searchFocusToken={searchFocusToken} /> : null}
        </>
      );
    }

    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Request focus' }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search your thoughts...')).toHaveFocus();
    });

    await user.click(screen.getByRole('button', { name: 'Toggle header' }));
    await user.click(screen.getByRole('button', { name: 'Toggle header' }));

    expect(screen.getByPlaceholderText('Search your thoughts...')).not.toHaveFocus();
  });

  it('clears and blurs search on Escape', async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();
    render(<Header {...defaultProps} searchQuery="hello" onSearchChange={onSearchChange} />);

    const input = screen.getByDisplayValue('hello');
    await user.click(input);
    await user.keyboard('{Escape}');

    expect(onSearchChange).toHaveBeenCalledWith('');
    expect(input).not.toHaveFocus();
  });
});
