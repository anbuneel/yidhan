import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BottomSheet } from './BottomSheet';

const { mobileState } = vi.hoisted(() => ({
  mobileState: { value: false },
}));

vi.mock('../hooks/useMobileDetect', () => ({
  useMobileDetect: () => mobileState.value,
}));

/**
 * Item 160: the Settings sheet keeps keyboard focus while it is open. Before this,
 * Tab walked out of the open dialog into the library behind it.
 */
function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open settings</button>
      <button type="button">Behind the sheet</button>
      <BottomSheet isOpen={open} onClose={() => setOpen(false)} title="Settings">
        <button type="button">First inside</button>
        <input aria-label="Display name" />
        <button type="button" disabled>Disabled inside</button>
        <button type="button">Last inside</button>
      </BottomSheet>
    </>
  );
}

const tab = (shiftKey = false) => fireEvent.keyDown(document, { key: 'Tab', shiftKey });

async function openSheet() {
  render(<Harness />);
  const opener = screen.getByRole('button', { name: 'Open settings' });
  opener.focus();
  fireEvent.click(opener);
  // The dialog can mount before the focus effect runs, so wait for focus itself:
  // the dialog being present is not proof that focus moved into it.
  const dialog = await screen.findByRole('dialog');
  await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  return opener;
}

describe('BottomSheet focus', () => {
  beforeEach(() => {
    mobileState.value = false;
  });

  it('moves focus into the sheet when it opens', async () => {
    await openSheet();
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
  });

  it('wraps Tab from the last control to the first, and Shift+Tab back', async () => {
    await openSheet();
    const dialog = screen.getByRole('dialog');
    const focusable = dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input');
    const first = focusable[0];
    const last = screen.getByRole('button', { name: 'Last inside' });

    last.focus();
    tab();
    expect(document.activeElement).toBe(first);

    tab(true);
    expect(document.activeElement).toBe(last);
  });

  it('leaves Tab alone between controls inside the sheet', async () => {
    await openSheet();
    const input = screen.getByRole('textbox', { name: 'Display name' });
    input.focus();
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('marks background content inert while open and restores it on close', async () => {
    const opener = await openSheet();
    const behind = screen.getByText('Behind the sheet');
    expect(behind).toHaveAttribute('inert');
    expect(behind).toHaveAttribute('aria-hidden', 'true');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(behind).not.toHaveAttribute('inert');
    expect(behind).not.toHaveAttribute('aria-hidden');
    expect(document.activeElement).toBe(opener);
  });

  it('pulls focus back in when it has escaped behind the sheet', async () => {
    await openSheet();
    screen.getByText('Behind the sheet').focus();
    tab();
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
  });

  it('still allows clicking the backdrop to dismiss while background is inert', async () => {
    await openSheet();
    fireEvent.click(screen.getByLabelText('Close sheet'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('returns focus to the opener on Escape', async () => {
    const opener = await openSheet();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('does not touch Tab while closed', () => {
    render(<Harness />);
    screen.getByRole('button', { name: 'Behind the sheet' }).focus();
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Behind the sheet' }));
  });

  it('re-registers the dialog node when isMobile flips while open and still restores the original opener', async () => {
    const { rerender } = render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Open settings' });
    opener.focus();
    fireEvent.click(opener);

    const desktopDialog = await screen.findByRole('dialog');
    expect(desktopDialog.tagName).toBe('DIALOG');
    await waitFor(() => expect(desktopDialog.contains(document.activeElement)).toBe(true));

    // Flip to mobile while open: DOM node swaps from <dialog> to <div role="dialog">.
    mobileState.value = true;
    rerender(<Harness />);

    const mobileDialog = await screen.findByRole('dialog');
    expect(mobileDialog.tagName).toBe('DIV');
    expect(mobileDialog).not.toBe(desktopDialog);
    await waitFor(() => expect(mobileDialog.contains(document.activeElement)).toBe(true));

    // Background remains inert, Tab stays trapped in the swapped node, and Escape returns
    // focus to the original page opener captured before the swap.
    expect(screen.getByText('Behind the sheet')).toHaveAttribute('inert');
    const last = screen.getByRole('button', { name: 'Last inside' });
    last.focus();
    tab();
    expect(mobileDialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(last);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.activeElement).toBe(opener);
  });
});
