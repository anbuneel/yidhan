import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShareModal } from './ShareModal';
import { createMockNote, createMockNoteShare } from '../test/factories';
import * as notesService from '../services/notes';
import toast from 'react-hot-toast';

// Mock the notes service
vi.mock('../services/notes', () => ({
  getNoteShare: vi.fn(),
  createNoteShare: vi.fn(),
  updateNoteShareExpiration: vi.fn(),
  revokeNoteShare: vi.fn(),
}));

// Mock the encryption module (toBase64Url for URL generation)
vi.mock('../lib/encryption', () => ({
  toBase64Url: vi.fn((bytes: Uint8Array) => 'mock-base64url-key-' + bytes.length),
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ShareModal', () => {
  const mockNote = createMockNote({ id: 'note-123', title: 'Test Note' });
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    note: mockNote,
    userId: 'user-123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no existing share
    vi.mocked(notesService.getNoteShare).mockResolvedValue(null);
  });

  describe('rendering', () => {
    it('renders nothing when isOpen is false', () => {
      const { container } = render(
        <ShareModal {...defaultProps} isOpen={false} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders modal when isOpen is true', async () => {
      render(<ShareModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Share as Letter' })).toBeInTheDocument();
      });
    });

    it('shows loading state initially', () => {
      // Make getNoteShare hang
      vi.mocked(notesService.getNoteShare).mockImplementation(
        () => new Promise(() => {})
      );

      render(<ShareModal {...defaultProps} />);

      // Loading spinner should be visible
      expect(screen.getByRole('heading', { name: 'Share as Letter' })).toBeInTheDocument();
      // Create button should not be visible during loading
      expect(screen.queryByText('Create Share Link')).not.toBeInTheDocument();
    });

    it('shows create share UI when no share exists', async () => {
      render(<ShareModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Create Share Link')).toBeInTheDocument();
      });
      expect(screen.getByText('Link expires in')).toBeInTheDocument();
    });

    it('shows key-not-recoverable message when existing share found', async () => {
      const existingShare = createMockNoteShare({
        noteId: mockNote.id,
        shareToken: 'abc123',
      });
      vi.mocked(notesService.getNoteShare).mockResolvedValue(existingShare);

      render(<ShareModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/complete link was shown when created/)).toBeInTheDocument();
      });
      expect(screen.getByText('Revoke & Re-create')).toBeInTheDocument();
    });
  });

  describe('creating share', () => {
    it('shows expiration options (no Never)', async () => {
      render(<ShareModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('1 day')).toBeInTheDocument();
      });
      expect(screen.getByText('7 days')).toBeInTheDocument();
      expect(screen.getByText('30 days')).toBeInTheDocument();
      // "Never" option removed for E2EE sharing
      expect(screen.queryByText('Never')).not.toBeInTheDocument();
    });

    it('creates share with selected expiration', async () => {
      const user = userEvent.setup();
      const newShare = createMockNoteShare({ shareToken: 'new-token' });
      const mockShareKey = new Uint8Array(32);
      vi.mocked(notesService.createNoteShare).mockResolvedValue({
        share: newShare,
        shareKey: mockShareKey,
      });

      render(<ShareModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Create Share Link')).toBeInTheDocument();
      });

      // Select 30 days expiration
      await user.click(screen.getByText('30 days'));
      await user.click(screen.getByText('Create Share Link'));

      await waitFor(() => {
        expect(notesService.createNoteShare).toHaveBeenCalledWith(
          mockNote.id,
          'user-123',
          mockNote,
          30
        );
      });
    });

    it('shows encrypted share link after creation', async () => {
      const user = userEvent.setup();
      const newShare = createMockNoteShare({ shareToken: 'new-token' });
      const mockShareKey = new Uint8Array(32);
      vi.mocked(notesService.createNoteShare).mockResolvedValue({
        share: newShare,
        shareKey: mockShareKey,
      });

      render(<ShareModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Create Share Link')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Create Share Link'));

      await waitFor(() => {
        // Should show the share link with /s/ path format and #k= fragment
        expect(screen.getByText('Encrypted share link')).toBeInTheDocument();
        const input = screen.getByDisplayValue(/\/s\/new-token/);
        expect(input).toBeInTheDocument();
      });
    });

    it('shows loading state while creating', async () => {
      const user = userEvent.setup();
      let resolveCreate: (result: { share: ReturnType<typeof createMockNoteShare>; shareKey: Uint8Array }) => void;
      const createPromise = new Promise<{ share: ReturnType<typeof createMockNoteShare>; shareKey: Uint8Array }>((resolve) => {
        resolveCreate = resolve;
      });
      vi.mocked(notesService.createNoteShare).mockReturnValue(createPromise);

      render(<ShareModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Create Share Link')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Create Share Link'));

      expect(screen.getByText('Encrypting...')).toBeInTheDocument();

      // Resolve the promise
      resolveCreate!({ share: createMockNoteShare({ shareToken: 'test' }), shareKey: new Uint8Array(32) });

      await waitFor(() => {
        expect(screen.queryByText('Encrypting...')).not.toBeInTheDocument();
      });
    });

    it('shows error toast on creation failure', async () => {
      const user = userEvent.setup();
      vi.mocked(notesService.createNoteShare).mockRejectedValue(new Error('Failed'));

      render(<ShareModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Create Share Link')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Create Share Link'));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to create share link');
      });
    });

    it('includes slug toggle checkbox', async () => {
      render(<ShareModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Include note title in link')).toBeInTheDocument();
      });
    });
  });

  describe('revoking share', () => {
    it('revokes existing share from key-not-recoverable view', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const existingShare = createMockNoteShare({ noteId: mockNote.id, shareToken: 'to-revoke' });
      vi.mocked(notesService.getNoteShare).mockResolvedValue(existingShare);
      vi.mocked(notesService.revokeNoteShare).mockResolvedValue(undefined);

      render(<ShareModal {...defaultProps} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('Revoke & Re-create')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Revoke & Re-create'));

      await waitFor(() => {
        expect(notesService.revokeNoteShare).toHaveBeenCalledWith(mockNote.id);
        expect(toast.success).toHaveBeenCalledWith('Share link revoked');
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('revokes share from just-created view', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const newShare = createMockNoteShare({ shareToken: 'just-created' });
      vi.mocked(notesService.createNoteShare).mockResolvedValue({
        share: newShare,
        shareKey: new Uint8Array(32),
      });
      vi.mocked(notesService.revokeNoteShare).mockResolvedValue(undefined);

      render(<ShareModal {...defaultProps} onClose={onClose} />);

      // Create a share first
      await waitFor(() => {
        expect(screen.getByText('Create Share Link')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Create Share Link'));

      // Now revoke it
      await waitFor(() => {
        expect(screen.getByText('Revoke Link')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Revoke Link'));

      await waitFor(() => {
        expect(notesService.revokeNoteShare).toHaveBeenCalledWith(mockNote.id);
        expect(toast.success).toHaveBeenCalledWith('Share link revoked');
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('shows error toast on revoke failure', async () => {
      const user = userEvent.setup();
      const existingShare = createMockNoteShare({ noteId: mockNote.id, shareToken: 'to-revoke' });
      vi.mocked(notesService.getNoteShare).mockResolvedValue(existingShare);
      vi.mocked(notesService.revokeNoteShare).mockRejectedValue(
        new Error('Revoke failed')
      );

      render(<ShareModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Revoke & Re-create')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Revoke & Re-create'));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to revoke share link');
      });
    });
  });

  describe('modal interactions', () => {
    it('closes when close button is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(<ShareModal {...defaultProps} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByLabelText('Close')).toBeInTheDocument();
      });

      await user.click(screen.getByLabelText('Close'));

      expect(onClose).toHaveBeenCalled();
    });

    it('closes when backdrop is clicked', async () => {
      const onClose = vi.fn();

      render(<ShareModal {...defaultProps} onClose={onClose} />);

      // Wait for loading to finish — backdrop onClick is disabled while isProcessing
      await waitFor(() => {
        expect(screen.getByText('Link expires in')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByLabelText('Close share dialog'));

      expect(onClose).toHaveBeenCalled();
    });

    it('does not close modal content when clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(<ShareModal {...defaultProps} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Share as Letter' })).toBeInTheDocument();
      });

      // Click the heading (inside the modal content)
      await user.click(screen.getByRole('heading', { name: 'Share as Letter' }));

      expect(onClose).not.toHaveBeenCalled();
    });

    it('disables close during processing', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      // Make getNoteShare hang to keep in loading state
      vi.mocked(notesService.getNoteShare).mockImplementation(
        () => new Promise(() => {})
      );

      render(<ShareModal {...defaultProps} onClose={onClose} />);

      // Try to click close button
      const closeButton = screen.getByLabelText('Close');
      expect(closeButton).toBeDisabled();
      await user.click(closeButton);

      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
