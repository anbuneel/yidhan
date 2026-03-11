/**
 * ConflictModal.test.tsx — Phase 3
 *
 * Tests the "Two Paths" sync conflict resolution modal.
 * Validates rendering of local/server versions, resolution buttons,
 * escape key handling, and "keep both" option.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConflictModal } from './ConflictModal';
import type { ConflictInfo } from '../services/syncEngine';

beforeEach(() => {
  vi.clearAllMocks();
});

type NoteConflict = Extract<ConflictInfo, { entityType: 'note' }>;

function createMockConflict(overrides: Partial<NoteConflict> = {}): NoteConflict {
  return {
    entityType: 'note',
    entityId: 'note-conflict-1',
    localVersion: {
      id: 'note-conflict-1',
      userId: 'user-1',
      title: 'Local Title',
      content: '<p>Local content here</p>',
      pinned: false,
      deletedAt: null,
      createdAt: Date.now() - 86400000,
      updatedAt: Date.now() - 3600000,
      syncStatus: 'pending',
      lastSyncedAt: null,
      serverUpdatedAt: null,
      localUpdatedAt: Date.now() - 3600000,
      encryptedPayload: null,
      encryptionIv: null,
      encryptionVersion: null,
      contentHash: null,
    },
    serverVersion: {
      id: 'note-conflict-1',
      title: 'Server Title',
      content: '<p>Server content here</p>',
      pinned: false,
      deleted_at: null,
      created_at: new Date(Date.now() - 86400000).toISOString(),
      updated_at: new Date(Date.now() - 1800000).toISOString(),
      encrypted_payload: null,
      encryption_iv: null,
      encryption_version: null,
      content_hash: null,
    },
    ...overrides,
  };
}

describe('ConflictModal', () => {
  const defaultProps = {
    conflict: createMockConflict(),
    onResolve: vi.fn().mockResolvedValue(undefined),
    onDismiss: vi.fn(),
  };

  it('should render the conflict modal with zen header', () => {
    render(<ConflictModal {...defaultProps} />);

    expect(screen.getByText('Two paths have formed')).toBeInTheDocument();
    expect(screen.getByText(/which feels truer/i)).toBeInTheDocument();
  });

  it('should render null when conflict is null', () => {
    const { container } = render(
      <ConflictModal conflict={null} onResolve={defaultProps.onResolve} onDismiss={defaultProps.onDismiss} />
    );

    expect(container.innerHTML).toBe('');
  });

  it('should render null for non-note conflicts', () => {
    const tagConflict: ConflictInfo = {
      entityType: 'tag',
      entityId: 'tag-conflict-1',
      localVersion: {
        id: 'tag-conflict-1',
        userId: 'user-1',
        name: 'Local Tag',
        color: 'gold',
        createdAt: Date.now() - 1000,
        syncStatus: 'pending',
        lastSyncedAt: null,
        serverUpdatedAt: null,
        localUpdatedAt: Date.now(),
      },
      serverVersion: {
        id: 'tag-conflict-1',
        userId: 'user-1',
        name: 'Server Tag',
        color: 'stone',
        createdAt: Date.now() - 1000,
        syncStatus: 'synced',
        lastSyncedAt: Date.now(),
        serverUpdatedAt: Date.now(),
        localUpdatedAt: Date.now(),
      },
    };
    const { container } = render(
      <ConflictModal conflict={tagConflict} onResolve={defaultProps.onResolve} onDismiss={defaultProps.onDismiss} />
    );

    expect(container.innerHTML).toBe('');
  });

  it('should display local and server version titles', () => {
    render(<ConflictModal {...defaultProps} />);

    expect(screen.getByText('Local Title')).toBeInTheDocument();
    expect(screen.getByText('Server Title')).toBeInTheDocument();
  });

  it('should display version labels', () => {
    render(<ConflictModal {...defaultProps} />);

    expect(screen.getByText('Your device')).toBeInTheDocument();
    expect(screen.getByText('Another device')).toBeInTheDocument();
  });

  it('should display content previews as plain text', () => {
    render(<ConflictModal {...defaultProps} />);

    expect(screen.getByText('Local content here')).toBeInTheDocument();
    expect(screen.getByText('Server content here')).toBeInTheDocument();
  });

  it('should show three resolution buttons', () => {
    render(<ConflictModal {...defaultProps} />);

    expect(screen.getByRole('button', { name: 'Keep local version' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep server version' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /keep both/i })).toBeInTheDocument();
  });

  it('should call onResolve with "local" when local "Keep this" is clicked', async () => {
    const onResolve = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<ConflictModal {...defaultProps} onResolve={onResolve} />);

    const localButton = screen.getByRole('button', { name: 'Keep local version' });
    await user.click(localButton);

    await waitFor(() => {
      expect(onResolve).toHaveBeenCalledWith('local');
    });
  });

  it('should call onResolve with "server" when server "Keep this" is clicked', async () => {
    const onResolve = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<ConflictModal {...defaultProps} onResolve={onResolve} />);

    const serverButton = screen.getByRole('button', { name: 'Keep server version' });
    await user.click(serverButton);

    await waitFor(() => {
      expect(onResolve).toHaveBeenCalledWith('server');
    });
  });

  it('should call onResolve with "both" when "Keep both" is clicked', async () => {
    const onResolve = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<ConflictModal {...defaultProps} onResolve={onResolve} />);

    await user.click(screen.getByRole('button', { name: /keep both/i }));

    await waitFor(() => {
      expect(onResolve).toHaveBeenCalledWith('both');
    });
  });

  it('should dismiss on Escape key', () => {
    const onDismiss = vi.fn();
    render(<ConflictModal {...defaultProps} onDismiss={onDismiss} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onDismiss).toHaveBeenCalled();
  });

  it('should NOT dismiss on Escape while resolving', async () => {
    const onDismiss = vi.fn();
    const onResolve = vi.fn().mockReturnValue(new Promise(() => {})); // Never resolves
    const user = userEvent.setup();

    render(<ConflictModal {...defaultProps} onResolve={onResolve} onDismiss={onDismiss} />);

    // Start resolving
    const localButton = screen.getByRole('button', { name: 'Keep local version' });
    await user.click(localButton);

    // Try to escape during resolving
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('should dismiss on backdrop click', () => {
    const onDismiss = vi.fn();
    render(<ConflictModal {...defaultProps} onDismiss={onDismiss} />);

    // Click on the backdrop (outer dialog element)
    const dialog = screen.getByRole('dialog');
    fireEvent.click(dialog);

    expect(onDismiss).toHaveBeenCalled();
  });

  it('should NOT dismiss when clicking inside the modal content', () => {
    const onDismiss = vi.fn();
    render(<ConflictModal {...defaultProps} onDismiss={onDismiss} />);

    // Click on text inside the modal
    fireEvent.click(screen.getByText('Two paths have formed'));

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('should disable buttons while resolving', async () => {
    const onResolve = vi.fn().mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();

    render(<ConflictModal {...defaultProps} onResolve={onResolve} />);

    const localButton = screen.getByRole('button', { name: 'Keep local version' });
    await user.click(localButton);

    // All buttons should now be disabled
    const allButtons = screen.getAllByRole('button');
    allButtons.forEach((button) => {
      expect(button).toBeDisabled();
    });
  });

  it('should show "Untitled" for notes with empty titles', () => {
    const base = createMockConflict();
    const conflict = createMockConflict({
      localVersion: { ...base.localVersion, title: '' },
      serverVersion: { ...base.serverVersion, title: '' },
    });

    render(
      <ConflictModal conflict={conflict} onResolve={defaultProps.onResolve} onDismiss={defaultProps.onDismiss} />
    );

    const untitledLabels = screen.getAllByText('Untitled');
    expect(untitledLabels).toHaveLength(2);
  });

  it('should reset buttons and log error when onResolve rejects', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onResolve = vi.fn().mockRejectedValue(new Error('Sync failed'));
    const user = userEvent.setup();

    render(<ConflictModal {...defaultProps} onResolve={onResolve} />);

    await user.click(screen.getByRole('button', { name: 'Keep local version' }));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to resolve conflict:', expect.any(Error));
      expect(screen.getByRole('button', { name: 'Keep local version' })).not.toBeDisabled();
    });

    consoleSpy.mockRestore();
  });

  it('renders delete-aware copy for hard-delete conflicts', () => {
    const base = createMockConflict();
    const hardDeleteConflict = createMockConflict({
      serverVersion: {
        ...base.serverVersion,
        title: '',
        content: '',
        deleted_at: new Date().toISOString(),
        hard_deleted: true,
        user_id: 'user-1',
      },
    });

    render(
      <ConflictModal conflict={hardDeleteConflict} onResolve={defaultProps.onResolve} onDismiss={defaultProps.onDismiss} />
    );

    expect(screen.getByText('Deleted on another device')).toBeInTheDocument();
    expect(screen.getByText('Restore this note')).toBeInTheDocument();
    expect(screen.getByText('Accept deletion')).toBeInTheDocument();
    expect(screen.getByText('Keep a copy instead')).toBeInTheDocument();
    expect(screen.getByText(/accepts the deletion/i)).toBeInTheDocument();
  });
});
