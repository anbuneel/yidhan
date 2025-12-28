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
  deleteNoteShare: vi.fn(),
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

    it('shows share link UI when share exists', async () => {
      const existingShare = createMockNoteShare({
        noteId: mockNote.id,
        shareToken: 'abc123',
      });
      vi.mocked(notesService.getNoteShare).mockResolvedValue(existingShare);

      render(<ShareModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Share link')).toBeInTheDocument();
      });
      expect(screen.getByDisplayValue(/\?s=abc123/)).toBeInTheDocument();
      expect(screen.getByText('Copy')).toBeInTheDocument();
      expect(screen.getByText('Revoke Link')).toBeInTheDocument();
    });
  });

  describe('creating share', () => {
    it('shows all expiration options', async () => {
      render(<ShareModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('1 day')).toBeInTheDocument();
      });
      expect(screen.getByText('7 days')).toBeInTheDocument();
      expect(screen.getByText('30 days')).toBeInTheDocument();
      expect(screen.getByText('Never')).toBeInTheDocument();
    });

    it('creates share with selected expiration', async () => {
      const user = userEvent.setup();
      const newShare = createMockNoteShare({ shareToken: 'new-token' });
      vi.mocked(notesService.createNoteShare).mockResolvedValue(newShare);

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
          30
        );
      });
    });

    it('shows loading state while creating', async () => {
      const user = userEvent.setup();
      let resolveCreate: (share: ReturnType<typeof createMockNoteShare>) => void;
      const createPromise = new Promise<ReturnType<typeof createMockNoteShare>>((resolve) => {
        resolveCreate = resolve;
      });
      vi.mocked(notesService.createNoteShare).mockReturnValue(createPromise);

      render(<ShareModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Create Share Link')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Create Share Link'));

      expect(screen.getByText('Creating...')).toBeInTheDocument();

      // Resolve the promise
      resolveCreate!(createMockNoteShare({ shareToken: 'test' }));

      await waitFor(() => {
        expect(screen.queryByText('Creating...')).not.toBeInTheDocument();
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
  });

  describe('existing share operations', () => {
    const existingShare = createMockNoteShare({
      noteId: mockNote.id,
      shareToken: 'existing-token',
    });

    beforeEach(() => {
      vi.mocked(notesService.getNoteShare).mockResolvedValue(existingShare);
    });

    it('copies link to clipboard', async () => {
      const user = userEvent.setup();
      const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);

      render(<ShareModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Copy')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Copy'));

      await waitFor(() => {
        expect(writeTextSpy).toHaveBeenCalledWith(
          expect.stringContaining('?s=existing-token')
        );
      });
      expect(toast.success).toHaveBeenCalledWith('Link copied to clipboard');

      writeTextSpy.mockRestore();
    });

    it('shows "Copied!" feedback after copy', async () => {
      const user = userEvent.setup();
      vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);

      render(<ShareModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Copy')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Copy'));

      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });

    it('shows error toast when copy fails', async () => {
      const user = userEvent.setup();
      vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('Clipboard error'));

      render(<ShareModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Copy')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Copy'));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to copy link');
      });
    });

    it('updates expiration on existing share', async () => {
      const user = userEvent.setup();
      const updatedShare = createMockNoteShare({ shareToken: 'existing-token' });
      vi.mocked(notesService.updateNoteShareExpiration).mockResolvedValue(updatedShare);

      render(<ShareModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Expires in')).toBeInTheDocument();
      });

      await user.click(screen.getByText('1 day'));

      await waitFor(() => {
        expect(notesService.updateNoteShareExpiration).toHaveBeenCalledWith(
          mockNote.id,
          1
        );
      });
    });

    it('shows error toast on expiration update failure', async () => {
      const user = userEvent.setup();
      vi.mocked(notesService.updateNoteShareExpiration).mockRejectedValue(
        new Error('Update failed')
      );

      render(<ShareModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Expires in')).toBeInTheDocument();
      });

      await user.click(screen.getByText('1 day'));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to update expiration');
      });
    });
  });

  describe('revoking share', () => {
    const existingShare = createMockNoteShare({
      noteId: mockNote.id,
      shareToken: 'to-revoke',
    });

    beforeEach(() => {
      vi.mocked(notesService.getNoteShare).mockResolvedValue(existingShare);
    });

    it('revokes share and closes modal', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      vi.mocked(notesService.deleteNoteShare).mockResolvedValue(undefined);

      render(<ShareModal {...defaultProps} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('Revoke Link')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Revoke Link'));

      await waitFor(() => {
        expect(notesService.deleteNoteShare).toHaveBeenCalledWith(mockNote.id);
        expect(toast.success).toHaveBeenCalledWith('Share link revoked');
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('shows loading state while revoking', async () => {
      const user = userEvent.setup();
      let resolveRevoke: () => void;
      const revokePromise = new Promise<void>((resolve) => {
        resolveRevoke = resolve;
      });
      vi.mocked(notesService.deleteNoteShare).mockReturnValue(revokePromise);

      render(<ShareModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Revoke Link')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Revoke Link'));

      expect(screen.getByText('Revoking...')).toBeInTheDocument();

      resolveRevoke!();

      await waitFor(() => {
        expect(screen.queryByText('Revoking...')).not.toBeInTheDocument();
      });
    });

    it('shows error toast on revoke failure', async () => {
      const user = userEvent.setup();
      vi.mocked(notesService.deleteNoteShare).mockRejectedValue(
        new Error('Revoke failed')
      );

      render(<ShareModal {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Revoke Link')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Revoke Link'));

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

      const { container } = render(<ShareModal {...defaultProps} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Share as Letter' })).toBeInTheDocument();
      });

      // Click the backdrop (the outermost fixed div) using fireEvent to bypass coordinate issues
      const backdrop = container.querySelector('.fixed.inset-0');
      if (backdrop) {
        fireEvent.click(backdrop);
      }

      expect(onClose).toHaveBeenCalled();
    });

    it('closes when Done button is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const existingShare = createMockNoteShare({ shareToken: 'test' });
      vi.mocked(notesService.getNoteShare).mockResolvedValue(existingShare);

      render(<ShareModal {...defaultProps} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('Done')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Done'));

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
