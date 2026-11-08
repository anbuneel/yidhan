import { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BottomSheet } from './BottomSheet';

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
  await screen.findByRole('dialog');
  return opener;
}

describe('BottomSheet focus', () => {
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

  it('pulls focus back in when it has escaped behind the sheet', async () => {
    await openSheet();
    screen.getByRole('button', { name: 'Behind the sheet' }).focus();
    tab();
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
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
});
