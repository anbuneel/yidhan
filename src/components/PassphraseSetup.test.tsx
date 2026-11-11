/**
 * Item 27: the three-step setup screen — passphrase, recovery key, done — with
 * the vault context faked. The real crypto and the fake server are in
 * `contexts/EncryptionContext.setup.test.tsx`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PassphraseSetup } from './PassphraseSetup';
import { PASSPHRASE_WORDS } from '../data/passphraseWords';
import { validatePassphrasePolicy } from '../utils/passphrasePolicy';

const KEY = 'ABCD-EFGH-IJKL-MNOP-QRST-UVWX-YZ23-4567-ABCD-EFGH-IJKL-MNOP-QRSA';
const OTHER_KEY = 'ZZZZ-EFGH-IJKL-MNOP-QRST-UVWX-YZ23-4567-ABCD-EFGH-IJKL-MNOP-QRSA';
const KEYS = { encryptionKey: 'enc', hashKey: 'hash' };

const encryptionState = { setupDone: false };

const {
  mockBeginAccountSetup,
  mockFinishAccountSetup,
  mockCreateEncryptedNote,
  mockCreateTagOffline,
  mockAddTagToNoteOffline,
} = vi.hoisted(() => ({
  mockBeginAccountSetup: vi.fn(),
  mockFinishAccountSetup: vi.fn(),
  mockCreateEncryptedNote: vi.fn(),
  mockCreateTagOffline: vi.fn(),
  mockAddTagToNoteOffline: vi.fn(),
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-setup-1', email: 'writer@example.com' } }),
}));

vi.mock('../contexts/EncryptionContext', () => ({
  useEncryption: () => ({
    beginAccountSetup: mockBeginAccountSetup,
    finishAccountSetup: mockFinishAccountSetup,
    setupDone: encryptionState.setupDone,
  }),
}));

vi.mock('../services/encryptedNotes', () => ({
  createEncryptedNote: (...args: unknown[]) => mockCreateEncryptedNote(...args),
}));
vi.mock('../services/offlineTags', () => ({
  createTagOffline: (...args: unknown[]) => mockCreateTagOffline(...args),
}));
vi.mock('../services/offlineNotes', () => ({
  addTagToNoteOffline: (...args: unknown[]) => mockAddTagToNoteOffline(...args),
}));

interface FakeSetup {
  committed: boolean;
  kits: Array<{ displayKey: string; commit: ReturnType<typeof vi.fn>; discard: ReturnType<typeof vi.fn> }>;
  prepareRecoveryKit: ReturnType<typeof vi.fn>;
  committedKeys: () => unknown;
  writeSent: boolean;
  writeAttempted: () => boolean;
  discard: ReturnType<typeof vi.fn>;
}

let setups: FakeSetup[];
let nextKeys: string[];
let commitImpl: () => Promise<void>;

function makeSetup(): FakeSetup {
  const setup: FakeSetup = {
    committed: false,
    kits: [],
    prepareRecoveryKit: vi.fn(),
    committedKeys: () => (setup.committed ? KEYS : null),
    writeSent: false,
    writeAttempted: () => setup.writeSent,
    discard: vi.fn(),
  };
  setup.prepareRecoveryKit.mockImplementation(() => {
    const kit = {
      displayKey: nextKeys.shift() ?? KEY,
      commit: vi.fn(async () => {
        setup.writeSent = true;
        await commitImpl();
        setup.committed = true;
      }),
      discard: vi.fn(),
    };
    setup.kits.push(kit);
    return kit;
  });
  setups.push(setup);
  return setup;
}

beforeEach(() => {
  vi.clearAllMocks();
  encryptionState.setupDone = false;
  setups = [];
  nextKeys = [KEY, OTHER_KEY];
  commitImpl = async () => {};
  mockBeginAccountSetup.mockImplementation(async () => makeSetup());
  mockCreateTagOffline.mockResolvedValue({ id: 'tag-recipes' });
  let n = 0;
  mockCreateEncryptedNote.mockImplementation(async () => ({ id: `note-${++n}` }));
  mockAddTagToNoteOffline.mockResolvedValue(undefined);
});

async function continueToKey() {
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  return screen.findByTestId('recovery-key');
}

async function confirmAndSave(key = KEY) {
  fireEvent.click(screen.getByRole('button', { name: /saved it/ }));
  fireEvent.change(screen.getByLabelText('Recovery key'), { target: { value: key } });
  fireEvent.click(screen.getByRole('button', { name: 'Save recovery key' }));
}

describe('PassphraseSetup — step 1, passphrase', () => {
  it('offers a generated passphrase by default, and it passes the policy', () => {
    render(<PassphraseSetup />);
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Choose a passphrase' })).toBeInTheDocument();
    const suggested = screen.getByTestId('suggested-passphrase').textContent!;
    const words = suggested.split('-');
    expect(words).toHaveLength(6);
    for (const word of words) expect(PASSPHRASE_WORDS).toContain(word);
    expect(validatePassphrasePolicy(suggested)).toBeNull();
    expect(screen.getByText(/about 65 bits of entropy/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
  });

  it('copies the suggestion in one tap', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<PassphraseSetup />);
    const suggested = screen.getByTestId('suggested-passphrase').textContent!;
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy' })); });
    expect(writeText).toHaveBeenCalledWith(suggested);
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });

  it('makes another suggestion on request', () => {
    render(<PassphraseSetup />);
    const first = screen.getByTestId('suggested-passphrase').textContent;
    fireEvent.click(screen.getByRole('button', { name: 'Another one' }));
    expect(screen.getByTestId('suggested-passphrase').textContent).not.toBe(first);
  });

  it('sets up with the suggestion when the writer continues', async () => {
    render(<PassphraseSetup />);
    const suggested = screen.getByTestId('suggested-passphrase').textContent;
    await continueToKey();
    expect(mockBeginAccountSetup).toHaveBeenCalledWith(suggested);
  });

  it('lets the writer type their own, and checks it against the policy', async () => {
    const user = userEvent.setup({ delay: null });
    render(<PassphraseSetup />);
    fireEvent.click(screen.getByRole('button', { name: 'Type my own instead' }));
    expect(screen.queryByTestId('suggested-passphrase')).toBeNull();
    const continueButton = screen.getByRole('button', { name: 'Continue' });
    expect(continueButton).toBeDisabled();

    await user.type(screen.getByLabelText('Passphrase'), 'short');
    expect(screen.getByText('Strength: Too short')).toBeInTheDocument();
    expect(continueButton).toBeDisabled();

    await user.clear(screen.getByLabelText('Passphrase'));
    await user.type(screen.getByLabelText('Passphrase'), 'a quiet harbour 42');
    await user.type(screen.getByLabelText('Confirm passphrase'), 'a quiet harbour 4');
    expect(screen.getByText('These don’t match yet.')).toBeInTheDocument();
    expect(continueButton).toBeDisabled();
    fireEvent.submit(continueButton.closest('form')!);
    expect(mockBeginAccountSetup).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Confirm passphrase'), '2');
    expect(continueButton).toBeEnabled();
    await continueToKey();
    expect(mockBeginAccountSetup).toHaveBeenCalledWith('a quiet harbour 42');
  });

  it('can go back to a suggestion from typing its own', () => {
    render(<PassphraseSetup />);
    fireEvent.click(screen.getByRole('button', { name: 'Type my own instead' }));
    fireEvent.click(screen.getByRole('button', { name: 'Use a passphrase made for me' }));
    expect(screen.getByTestId('suggested-passphrase')).toBeInTheDocument();
  });

  it('has no "cannot be recovered" checkbox or alarm copy any more', () => {
    render(<PassphraseSetup />);
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(document.body.textContent).not.toMatch(/cannot be recovered|no recovery|warning/i);
    expect(screen.getByText(/recovery key\s+in case you ever forget it/)).toBeInTheDocument();
  });

  it('tells the account password and the passphrase apart', () => {
    render(<PassphraseSetup />);
    expect(screen.getByText(/Your password signs you in\. Your passphrase is a separate secret/)).toBeInTheDocument();
  });

  it('shows the context’s refusal and stays on step 1', async () => {
    mockBeginAccountSetup.mockRejectedValueOnce(new Error('Encryption is already set up for this account.'));
    render(<PassphraseSetup />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('already set up');
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
  });
});

describe('PassphraseSetup — step 2, recovery key', () => {
  it('shows the key with no way to skip it', async () => {
    render(<PassphraseSetup />);
    expect(await continueToKey()).toHaveTextContent(KEY);
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /not now|skip|later/i })).toBeNull();
  });

  it('cannot reach step 3 without the key typed back', async () => {
    render(<PassphraseSetup />);
    await continueToKey();
    fireEvent.click(screen.getByRole('button', { name: /saved it/ }));
    const save = screen.getByRole('button', { name: 'Save recovery key' });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Recovery key'), { target: { value: OTHER_KEY } });
    expect(save).toBeDisabled();
    fireEvent.submit(save.closest('form')!);
    expect(setups[0].kits[0].commit).not.toHaveBeenCalled();
    expect(screen.queryByText('Step 3 of 3')).toBeNull();
  });

  it('Back returns to step 1, puts the key away, and Continue makes a new one', async () => {
    render(<PassphraseSetup />);
    const suggested = screen.getByTestId('suggested-passphrase').textContent;
    await continueToKey();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
    expect(screen.getByTestId('suggested-passphrase').textContent).toBe(suggested);
    expect(setups[0].discard).toHaveBeenCalled();
    expect(setups[0].kits[0].discard).toHaveBeenCalled();

    expect(await continueToKey()).toHaveTextContent(OTHER_KEY);
    expect(mockBeginAccountSetup).toHaveBeenCalledTimes(2);
    // The first key cannot be saved now: it belongs to a setup that is gone.
    await confirmAndSave(KEY);
    expect(screen.getByRole('button', { name: 'Save recovery key' })).toBeDisabled();
    expect(setups[1].kits[0].commit).not.toHaveBeenCalled();
  });

  it('Back from the confirm step also goes to step 1, never forward', async () => {
    render(<PassphraseSetup />);
    await continueToKey();
    fireEvent.click(screen.getByRole('button', { name: /saved it/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
    expect(screen.queryByText('Step 3 of 3')).toBeNull();
    expect(mockFinishAccountSetup).not.toHaveBeenCalled();
  });

  it('cannot go Back while the key is saving', async () => {
    let release!: () => void;
    commitImpl = () => new Promise<void>((resolve) => { release = resolve; });
    render(<PassphraseSetup />);
    await continueToKey();
    await confirmAndSave();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled());
    await act(async () => { release(); });
    expect(await screen.findByText('Step 3 of 3')).toBeInTheDocument();
  });

  it('says plainly when the account was set up elsewhere, and stays on the key', async () => {
    commitImpl = async () => {
      throw Object.assign(new Error('x'), { code: 'changed' });
    };
    render(<PassphraseSetup />);
    await continueToKey();
    await confirmAndSave();
    expect(await screen.findByRole('alert')).toHaveTextContent('set up in another tab or on another device');
    expect(screen.queryByText('Step 3 of 3')).toBeNull();
  });

  it('cannot go Back after a save that sent its write, even when it reported a failure', async () => {
    // The write may have landed with only its answer lost. Going back would
    // start a second setup the server would refuse, and abandon the first.
    commitImpl = async () => {
      throw Object.assign(new Error('x'), { code: 'failed' });
    };
    render(<PassphraseSetup />);
    await continueToKey();
    await confirmAndSave();
    expect(await screen.findByRole('alert')).toHaveTextContent('Setup didn’t finish');
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
    // Retrying the same key stays possible.
    commitImpl = async () => {};
    fireEvent.click(screen.getByRole('button', { name: 'Save recovery key' }));
    expect(await screen.findByText('Step 3 of 3')).toBeInTheDocument();
    expect(setups).toHaveLength(1);
  });

  it('says plainly when offline', async () => {
    commitImpl = async () => {
      throw Object.assign(new Error('x'), { code: 'offline' });
    };
    render(<PassphraseSetup />);
    await continueToKey();
    await confirmAndSave();
    expect(await screen.findByRole('alert')).toHaveTextContent('You’re offline');
  });

  it('puts the setup away when the screen goes before the write', async () => {
    const { unmount } = render(<PassphraseSetup />);
    await continueToKey();
    unmount();
    expect(setups[0].discard).toHaveBeenCalled();
    expect(setups[0].kits[0].discard).toHaveBeenCalled();
  });
});

describe('PassphraseSetup — step 3, done', () => {
  it('comes back to step 3, not step 1, when remounted after the write landed', () => {
    encryptionState.setupDone = true;
    render(<PassphraseSetup />);
    expect(screen.getByText('Step 3 of 3')).toBeInTheDocument();
    expect(screen.queryByTestId('suggested-passphrase')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open my notes' }));
    return waitFor(() => expect(mockFinishAccountSetup).toHaveBeenCalledTimes(1));
  });

  it('confirms calmly, creates the starter notes with the new keys, and opens the library', async () => {
    render(<PassphraseSetup />);
    await continueToKey();
    await confirmAndSave();

    expect(await screen.findByRole('heading', { name: 'Your notes are ready' })).toBeInTheDocument();
    expect(screen.getByText('Step 3 of 3')).toBeInTheDocument();
    expect(screen.getByText(/Devices already open\s+keep working; the next time one asks for your passphrase, enter the new one/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    await waitFor(() => expect(mockCreateEncryptedNote).toHaveBeenCalledTimes(2));
    expect(mockCreateEncryptedNote).toHaveBeenCalledWith('user-setup-1', 'Welcome to Yidhan', expect.any(String), KEYS, true);
    expect(mockCreateEncryptedNote).toHaveBeenCalledWith('user-setup-1', 'Things you can type', expect.any(String), KEYS, false);
    // The starters carry no tag, so setup creates none.
    expect(mockCreateTagOffline).not.toHaveBeenCalled();
    expect(mockAddTagToNoteOffline).not.toHaveBeenCalled();

    expect(mockFinishAccountSetup).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Open my notes' }));
    await waitFor(() => expect(mockFinishAccountSetup).toHaveBeenCalledTimes(1));
  });

  it('opens the library only after the starter notes are written', async () => {
    let release!: () => void;
    mockCreateEncryptedNote
      .mockImplementationOnce(async () => ({ id: 'note-1' }))
      .mockImplementationOnce(() => new Promise((resolve) => { release = () => resolve({ id: 'note-2' }); }));
    render(<PassphraseSetup />);
    await continueToKey();
    await confirmAndSave();
    await screen.findByRole('heading', { name: 'Your notes are ready' });
    await waitFor(() => expect(mockCreateEncryptedNote).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole('button', { name: 'Open my notes' }));
    expect(screen.getByRole('button', { name: 'Open my notes' })).toBeDisabled();
    expect(mockFinishAccountSetup).not.toHaveBeenCalled();
    await act(async () => { release(); });
    await waitFor(() => expect(mockFinishAccountSetup).toHaveBeenCalledTimes(1));
  });

  it('still reaches step 3 when the starter notes fail', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockCreateEncryptedNote.mockRejectedValue(new Error('IndexedDB unavailable'));
    render(<PassphraseSetup />);
    await continueToKey();
    await confirmAndSave();
    expect(await screen.findByRole('heading', { name: 'Your notes are ready' })).toBeInTheDocument();
    await waitFor(() => expect(consoleError).toHaveBeenCalledWith('Failed to create starter notes'));
    consoleError.mockRestore();
  });

  it('creates no starter notes when the save fails', async () => {
    commitImpl = async () => {
      throw Object.assign(new Error('x'), { code: 'failed' });
    };
    render(<PassphraseSetup />);
    await continueToKey();
    await confirmAndSave();
    expect(await screen.findByRole('alert')).toHaveTextContent('Setup didn’t finish');
    expect(mockCreateEncryptedNote).not.toHaveBeenCalled();
    expect(mockFinishAccountSetup).not.toHaveBeenCalled();
  });
});
