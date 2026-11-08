/**
 * Item 26: the recovery-key screen. 26-T3 at the component: the key is shown
 * once, the save waits for the writer to type it back, and once saved nothing on
 * screen can show it again.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { RecoveryKeyKit } from './RecoveryKeyKit';
import type { PreparedRecoveryKit } from '../contexts/EncryptionContext';

const KEY = 'ABCD-EFGH-IJKL-MNOP-QRST-UVWX-YZ23-4567-ABCD-EFGH-IJKL-MNOP-QRSA';

function makeKit(overrides: Partial<PreparedRecoveryKit> = {}) {
  return {
    displayKey: KEY,
    commit: vi.fn(async () => {}),
    discard: vi.fn(),
    ...overrides,
  };
}

function typeKey(value: string) {
  fireEvent.change(screen.getByLabelText('Recovery key'), { target: { value } });
}

describe('RecoveryKeyKit', () => {
  let kit: ReturnType<typeof makeKit>;
  let prepare: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    kit = makeKit();
    prepare = vi.fn(async () => kit);
  });

  it('starts on an offer when asked, and makes the key only when the writer chooses to', async () => {
    const onSkip = vi.fn();
    render(<RecoveryKeyKit prepare={prepare} onDone={vi.fn()} onSkip={onSkip} startWithIntro />);
    expect(screen.getByRole('heading', { name: 'Make a recovery key' })).toBeInTheDocument();
    expect(prepare).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(onSkip).toHaveBeenCalled();
    expect(prepare).not.toHaveBeenCalled();
  });

  it('shows the key, then saves only after it is typed back', async () => {
    const onDone = vi.fn();
    render(<RecoveryKeyKit prepare={prepare} onDone={onDone} />);
    expect(await screen.findByTestId('recovery-key')).toHaveTextContent(KEY);

    fireEvent.click(screen.getByRole('button', { name: /saved it/ }));
    const save = screen.getByRole('button', { name: 'Save recovery key' });
    expect(save).toBeDisabled();

    typeKey(KEY.slice(0, 20));
    expect(save).toBeDisabled();
    expect(screen.getByText('This doesn’t match yet.')).toBeInTheDocument();
    fireEvent.submit(save.closest('form')!);
    expect(kit.commit).not.toHaveBeenCalled();

    // Spacing and case do not matter.
    typeKey(KEY.toLowerCase().replace(/-/g, ' '));
    expect(save).toBeEnabled();
    fireEvent.click(save);
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(kit.commit).toHaveBeenCalledTimes(1);
  });

  it('26-T3: once saved, the key is gone from the screen', async () => {
    let finish!: () => void;
    const onDone = vi.fn();
    render(<RecoveryKeyKit prepare={prepare} onDone={onDone} />);
    await screen.findByTestId('recovery-key');
    fireEvent.click(screen.getByRole('button', { name: /saved it/ }));
    typeKey(KEY);
    kit.commit.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
    fireEvent.click(screen.getByRole('button', { name: 'Save recovery key' }));
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Show the key again' })).toBeDisabled();
    await act(async () => { finish(); });
    expect(onDone).toHaveBeenCalled();
    expect(document.body.textContent).not.toContain(KEY);
    expect(screen.queryByTestId('recovery-key')).toBeNull();
  });

  it('a failed save keeps the key and says so, without claiming it was saved', async () => {
    kit.commit.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'offline' }));
    const onDone = vi.fn();
    render(<RecoveryKeyKit prepare={prepare} onDone={onDone} />);
    await screen.findByTestId('recovery-key');
    fireEvent.click(screen.getByRole('button', { name: /saved it/ }));
    typeKey(KEY);
    fireEvent.click(screen.getByRole('button', { name: 'Save recovery key' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('offline');
    expect(onDone).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Save recovery key' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  it('cannot be left before saving when there is no skip (item 27)', async () => {
    render(<RecoveryKeyKit prepare={prepare} onDone={vi.fn()} />);
    await screen.findByTestId('recovery-key');
    expect(screen.queryByRole('button', { name: 'Not now' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
  });

  it('discards the key when skipped or unmounted', async () => {
    const onSkip = vi.fn();
    const first = render(<RecoveryKeyKit prepare={prepare} onDone={vi.fn()} onSkip={onSkip} />);
    await screen.findByTestId('recovery-key');
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(kit.discard).toHaveBeenCalled();
    expect(onSkip).toHaveBeenCalled();
    first.unmount();

    const second = makeKit();
    render(<RecoveryKeyKit prepare={async () => second} onDone={vi.fn()} />).unmount();
    // Unmounted before prepare resolved: the late kit is discarded too.
    await waitFor(() => expect(second.discard).toHaveBeenCalled());
  });

  it('copies and prints the key', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const print = vi.spyOn(window, 'print').mockImplementation(() => {
      expect(document.body.classList.contains('printing-recovery-key')).toBe(true);
    });
    render(<RecoveryKeyKit prepare={prepare} onDone={vi.fn()} accountEmail="writer@example.com" />);
    await screen.findByTestId('recovery-key');

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(KEY));
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Print' }));
    expect(print).toHaveBeenCalled();
    window.dispatchEvent(new Event('afterprint'));
    expect(document.body.classList.contains('printing-recovery-key')).toBe(false);
    print.mockRestore();
  });

  it('marks the key and the confirmation field for masking in session replays', async () => {
    render(<RecoveryKeyKit prepare={prepare} onDone={vi.fn()} />);
    expect(await screen.findByTestId('recovery-key')).toHaveAttribute('data-sensitive');
    fireEvent.click(screen.getByRole('button', { name: /saved it/ }));
    expect(screen.getByLabelText('Recovery key')).toHaveAttribute('data-sensitive');
  });

  it('a failure to make the key returns to the offer with a calm message', async () => {
    prepare.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'not-ready' }));
    render(<RecoveryKeyKit prepare={prepare} onDone={vi.fn()} onSkip={vi.fn()} startWithIntro />);
    fireEvent.click(screen.getByRole('button', { name: 'Make a recovery key' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('can’t be made just yet');
    fireEvent.click(screen.getByRole('button', { name: 'Make a recovery key' }));
    expect(await screen.findByTestId('recovery-key')).toBeInTheDocument();
  });
});
