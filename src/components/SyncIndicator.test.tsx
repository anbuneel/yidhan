import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const { mockToast, mockSyncStatus, mockPersistence, mockInstall } = vi.hoisted(() => ({
  mockToast: vi.fn(),
  mockSyncStatus: vi.fn(),
  mockPersistence: vi.fn(),
  mockInstall: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({ default: (...args: unknown[]) => mockToast(...args) }));
vi.mock('../hooks/useSyncStatus', () => ({ useSyncStatus: () => mockSyncStatus() }));
vi.mock('../hooks/useStoragePersistence', () => ({
  useStoragePersistence: () => mockPersistence(),
}));
vi.mock('../hooks/useInstallPrompt', () => ({ useInstallPrompt: () => mockInstall() }));

import { SyncIndicator } from './SyncIndicator';
import { resetStoragePersistenceForTests } from '../utils/storagePersistence';

const synced = {
  isOnline: true,
  pendingCount: 0,
  blockedCount: 0,
  blockedReason: null,
  isStuck: false,
  refresh: vi.fn(),
};

const blocked = { ...synced, blockedCount: 2, blockedReason: 'The server refused this change.' };
const stuckPending = { ...synced, pendingCount: 1, isStuck: true };

function persistence(state: 'granted' | 'denied' | 'unsupported') {
  return { state, isDenied: state === 'denied', usageBytes: null, quotaBytes: null, request: vi.fn() };
}

describe('SyncIndicator', () => {
  const triggerInstall = vi.fn();

  beforeEach(() => {
    resetStoragePersistenceForTests();
    mockToast.mockClear();
    triggerInstall.mockClear();
    mockPersistence.mockReturnValue(persistence('granted'));
    mockInstall.mockReturnValue({ isInstallable: false, canInstallOnIOS: false, triggerInstall });
  });

  it('renders nothing when everything is synced', () => {
    mockSyncStatus.mockReturnValue(synced);
    const { container } = render(<SyncIndicator />);
    expect(container).toBeEmptyDOMElement();
  });

  it('does not flag lingering work when storage is persisted', () => {
    mockSyncStatus.mockReturnValue(blocked);
    render(<SyncIndicator />);

    expect(screen.getByText('2 blocked')).toBeInTheDocument();
    expect(screen.queryByText(/on this device only/)).not.toBeInTheDocument();
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('does not flag a browser that lacks the API — it has not declined anything', () => {
    mockSyncStatus.mockReturnValue(blocked);
    mockPersistence.mockReturnValue(persistence('unsupported'));
    render(<SyncIndicator />);

    expect(screen.queryByText(/on this device only/)).not.toBeInTheDocument();
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('says blocked work is on this device only when the browser declined persistence', () => {
    mockSyncStatus.mockReturnValue(blocked);
    mockPersistence.mockReturnValue(persistence('denied'));
    render(<SyncIndicator />);

    expect(screen.getByText(/on this device only/)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('kept only on this device')
    );
    expect(mockToast).toHaveBeenCalledTimes(1);
  });

  it('flags stuck pending work too, but not normal sub-threshold pending', () => {
    mockPersistence.mockReturnValue(persistence('denied'));

    mockSyncStatus.mockReturnValue(stuckPending);
    const { unmount } = render(<SyncIndicator />);
    expect(screen.getByText(/on this device only/)).toBeInTheDocument();
    unmount();
    resetStoragePersistenceForTests();

    // Pending but not yet stuck: the indicator is invisible by design, and
    // a warning here would flash on every keystroke.
    mockSyncStatus.mockReturnValue({ ...synced, pendingCount: 1, isStuck: false });
    const { container } = render(<SyncIndicator />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the notice once per session, not once per mount', () => {
    // Header unmounts on every editor round-trip, so a mount-scoped guard
    // would re-fire this each time the user returns to the library.
    mockSyncStatus.mockReturnValue(blocked);
    mockPersistence.mockReturnValue(persistence('denied'));

    const first = render(<SyncIndicator />);
    expect(mockToast).toHaveBeenCalledTimes(1);
    first.unmount();

    render(<SyncIndicator />);
    expect(mockToast).toHaveBeenCalledTimes(1);
  });

  it('keeps the risk caption and Install action visible while offline', () => {
    // Offline is exactly when lingering changes are necessarily local-only,
    // and the Offline branch used to return before the caption could render —
    // leaving the seven-second toast as the only warning.
    mockSyncStatus.mockReturnValue({ ...stuckPending, isOnline: false });
    mockPersistence.mockReturnValue(persistence('denied'));
    mockInstall.mockReturnValue({ isInstallable: true, triggerInstall });
    render(<SyncIndicator />);

    expect(screen.getByText('Offline')).toBeInTheDocument();
    expect(screen.getByText(/on this device only/)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('kept only on this device')
    );
    expect(screen.getByRole('button', { name: /Install to protect/ })).toBeInTheDocument();
  });

  it('does not flag offline work when storage is persisted', () => {
    mockSyncStatus.mockReturnValue({ ...stuckPending, isOnline: false });
    render(<SyncIndicator />);

    expect(screen.getByText('Offline')).toBeInTheDocument();
    expect(screen.queryByText(/on this device only/)).not.toBeInTheDocument();
  });

  it('points iOS Safari at Add to Home Screen, since it never fires beforeinstallprompt', () => {
    // Safari's storage eviction makes iOS the most exposed group, and it has
    // no installable prompt to offer — so say what to do instead of showing
    // a caption with no way forward.
    mockSyncStatus.mockReturnValue(blocked);
    mockPersistence.mockReturnValue(persistence('denied'));
    mockInstall.mockReturnValue({ isInstallable: false, canInstallOnIOS: true, triggerInstall });
    render(<SyncIndicator />);

    expect(screen.getByText(/Add to Home Screen to protect/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Install to protect/ })).not.toBeInTheDocument();
  });

  it('offers Install only when the browser can install, and triggers it', () => {
    mockSyncStatus.mockReturnValue(blocked);
    mockPersistence.mockReturnValue(persistence('denied'));

    const { unmount } = render(<SyncIndicator />);
    expect(screen.queryByRole('button', { name: /Install to protect/ })).not.toBeInTheDocument();
    unmount();

    mockInstall.mockReturnValue({ isInstallable: true, triggerInstall });
    render(<SyncIndicator />);
    fireEvent.click(screen.getByRole('button', { name: /Install to protect/ }));
    expect(triggerInstall).toHaveBeenCalledTimes(1);
  });
});
