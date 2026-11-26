import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PasswordInput } from './PasswordInput';

function Form({ onSubmit = vi.fn() }: { onSubmit?: () => void }) {
  const [value, setValue] = useState('');
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
      <label htmlFor="pw">Passphrase</label>
      <PasswordInput
        id="pw"
        revealLabel="passphrase"
        autoComplete="new-password"
        data-sensitive
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button type="submit">Save</button>
    </form>
  );
}

const field = () => screen.getByLabelText('Passphrase') as HTMLInputElement;
const toggle = () => screen.getByRole('button', { name: 'Show passphrase' });

describe('PasswordInput', () => {
  it('starts hidden, with a real toggle button that is not pressed', () => {
    render(<Form />);
    expect(field().type).toBe('password');
    expect(toggle().tagName).toBe('BUTTON');
    expect(toggle()).toHaveAttribute('type', 'button');
    expect(toggle()).toHaveAttribute('aria-pressed', 'false');
    expect(toggle()).toHaveAttribute('aria-controls', 'pw');
  });

  it('shows and hides the value, keeping one accessible name', async () => {
    const user = userEvent.setup({ delay: null });
    render(<Form />);
    await user.click(toggle());
    expect(field().type).toBe('text');
    expect(toggle()).toHaveAttribute('aria-pressed', 'true');
    await user.click(toggle());
    expect(field().type).toBe('password');
    expect(toggle()).toHaveAttribute('aria-pressed', 'false');
  });

  it('does not submit the form when toggled', async () => {
    const user = userEvent.setup({ delay: null });
    const onSubmit = vi.fn();
    render(<Form onSubmit={onSubmit} />);
    await user.click(toggle());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('goes back to hidden when the form submits', async () => {
    const user = userEvent.setup({ delay: null });
    const onSubmit = vi.fn();
    render(<Form onSubmit={onSubmit} />);
    await user.type(field(), 'correct horse battery');
    await user.click(toggle());
    expect(field().type).toBe('text');
    fireEvent.submit(field().form!);
    expect(onSubmit).toHaveBeenCalled();
    expect(field().type).toBe('password');
    expect(toggle()).toHaveAttribute('aria-pressed', 'false');
  });

  it('starts hidden again after an unmount and remount', async () => {
    const user = userEvent.setup({ delay: null });
    const { unmount } = render(<Form />);
    await user.click(toggle());
    unmount();
    render(<Form />);
    expect(field().type).toBe('password');
  });

  it('keeps autoComplete, data-sensitive and the forwarded ref', () => {
    const ref = createRef<HTMLInputElement>();
    render(<PasswordInput ref={ref} id="x" aria-label="Password" autoComplete="current-password" data-sensitive />);
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('autocomplete', 'current-password');
    expect(input).toHaveAttribute('data-sensitive');
    expect(ref.current).toBe(input);
  });

  it('disables the toggle with the field', () => {
    render(<PasswordInput id="x" aria-label="Password" disabled />);
    expect(screen.getByRole('button', { name: 'Show password' })).toBeDisabled();
  });

  it('works outside a form', async () => {
    const user = userEvent.setup({ delay: null });
    render(<PasswordInput id="x" aria-label="Password" />);
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect((screen.getByLabelText('Password') as HTMLInputElement).type).toBe('text');
  });

  it('never logs the value', async () => {
    const user = userEvent.setup({ delay: null });
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    render(<Form />);
    await user.type(field(), 'secret-value-123');
    await user.click(toggle());
    fireEvent.submit(field().form!);
    for (const spy of spies) {
      expect(JSON.stringify(spy.mock.calls)).not.toContain('secret-value-123');
      spy.mockRestore();
    }
  });
});

describe('password fields across the app', () => {
  it('every password and passphrase field uses PasswordInput', () => {
    const dir = resolve(__dirname);
    const offenders = readdirSync(dir)
      .filter((f) => f.endsWith('.tsx') && !f.includes('.test.') && f !== 'PasswordInput.tsx')
      .filter((f) => /type=(\{[^}]*)?["']password["']/.test(readFileSync(resolve(dir, f), 'utf8')));
    expect(offenders).toEqual([]);
  });
});
