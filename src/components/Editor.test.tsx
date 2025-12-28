import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Editor } from './Editor';
import { createMockNote, createMockTag } from '../test/factories';
import { useAuth } from '../contexts/AuthContext';
import * as exportImport from '../utils/exportImport';

// Mock dependencies
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('./RichTextEditor', () => ({
  RichTextEditor: ({ content, onChange, onBlur }: { content: string; onChange: (c: string) => void; onBlur: () => void }) => (
    <div data-testid="rich-text-editor" onBlur={onBlur}>
      <textarea
        data-testid="editor-content"
        value={content}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  ),
}));

vi.mock('./EditorToolbar', () => ({
  EditorToolbar: () => <div data-testid="editor-toolbar">Toolbar</div>,
}));

vi.mock('./TagSelector', () => ({
  TagSelector: ({ onCreateTag }: { onCreateTag?: () => void }) => (
    <div data-testid="tag-selector">
      {onCreateTag && <button onClick={onCreateTag}>Create Tag</button>}
    </div>
  ),
}));

vi.mock('./WhisperBack', () => ({
  WhisperBack: ({ onClick }: { onClick: () => void }) => (
    <button data-testid="whisper-back" onClick={onClick}>Back</button>
  ),
}));

vi.mock('./ShareModal', () => ({
  ShareModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? <div data-testid="share-modal"><button onClick={onClose}>Close</button></div> : null,
}));

vi.mock('./HeaderShell', () => ({
  HeaderShell: ({
    onThemeToggle,
    leftContent,
    rightActions
  }: {
    theme: string;
    onThemeToggle: () => void;
    leftContent?: React.ReactNode;
    rightActions?: React.ReactNode;
  }) => (
    <div data-testid="header-shell">
      <div data-testid="header-left">{leftContent}</div>
      <button onClick={onThemeToggle}>Toggle Theme</button>
      <div data-testid="header-right">{rightActions}</div>
    </div>
  ),
}));

// Mock export/import utilities
vi.mock('../utils/exportImport', () => ({
  exportNoteToMarkdown: vi.fn().mockReturnValue('# Test'),
  exportNoteToJSON: vi.fn().mockReturnValue('{}'),
  getSanitizedFilename: vi.fn().mockReturnValue('test'),
  downloadFile: vi.fn(),
  copyNoteToClipboard: vi.fn().mockResolvedValue(undefined),
  copyNoteWithFormatting: vi.fn().mockResolvedValue(undefined),
}));

describe('Editor', () => {
  const mockNote = createMockNote({
    id: 'note-123',
    title: 'Test Note',
    content: '<p>Test content</p>',
    tags: [createMockTag({ id: 'tag-1', name: 'Work' })],
  });

  const mockTags = [
    createMockTag({ id: 'tag-1', name: 'Work' }),
    createMockTag({ id: 'tag-2', name: 'Personal' }),
  ];

  const defaultProps = {
    note: mockNote,
    tags: mockTags,
    userId: 'user-123',
    onBack: vi.fn(),
    onUpdate: vi.fn(),
    onDelete: vi.fn(),
    onToggleTag: vi.fn(),
    onCreateTag: vi.fn(),
    theme: 'dark' as const,
    onThemeToggle: vi.fn(),
    onSettingsClick: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(useAuth).mockReturnValue({
      user: {
        id: 'user-123',
        email: 'test@example.com',
        user_metadata: { full_name: 'Test User' },
        app_metadata: {},
        aud: 'authenticated',
        created_at: '2024-01-01',
      },
      signOut: vi.fn(),
      signIn: vi.fn(),
      signUp: vi.fn(),
      signInWithGoogle: vi.fn(),
      signInWithGitHub: vi.fn(),
      resetPassword: vi.fn(),
      updatePassword: vi.fn(),
      updateProfile: vi.fn(),
      clearPasswordRecovery: vi.fn(),
      initiateOffboarding: vi.fn(),
      cancelOffboarding: vi.fn(),
      isPasswordRecovery: false,
      isDeparting: false,
      daysUntilRelease: null,
      loading: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('rendering', () => {
    it('renders the note title', () => {
      render(<Editor {...defaultProps} />);
      expect(screen.getByDisplayValue('Test Note')).toBeInTheDocument();
    });

    it('renders the header with title in breadcrumb', () => {
      render(<Editor {...defaultProps} />);
      // The header left content should include the note title
      expect(screen.getByTestId('header-left')).toHaveTextContent('Zenote');
      expect(screen.getByTestId('header-left')).toHaveTextContent('Test Note');
    });

    it('renders the editor toolbar', () => {
      render(<Editor {...defaultProps} />);
      expect(screen.getByTestId('editor-toolbar')).toBeInTheDocument();
    });

    it('renders the tag selector', () => {
      render(<Editor {...defaultProps} />);
      expect(screen.getByTestId('tag-selector')).toBeInTheDocument();
    });

    it('renders the rich text editor', () => {
      render(<Editor {...defaultProps} />);
      expect(screen.getByTestId('rich-text-editor')).toBeInTheDocument();
    });

    it('renders return to notes link in footer', () => {
      render(<Editor {...defaultProps} />);
      expect(screen.getByText('Return to notes')).toBeInTheDocument();
    });

    it('renders whisper back button', () => {
      render(<Editor {...defaultProps} />);
      expect(screen.getByTestId('whisper-back')).toBeInTheDocument();
    });
  });

  describe('title editing', () => {
    it('updates title on change', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<Editor {...defaultProps} />);

      const titleInput = screen.getByDisplayValue('Test Note');
      await user.clear(titleInput);
      await user.type(titleInput, 'New Title');

      expect(screen.getByDisplayValue('New Title')).toBeInTheDocument();
    });
  });

  describe('auto-save', () => {
    it('triggers save after 1.5 seconds of inactivity', async () => {
      const onUpdate = vi.fn();
      render(<Editor {...defaultProps} onUpdate={onUpdate} />);

      const titleInput = screen.getByDisplayValue('Test Note');
      fireEvent.change(titleInput, { target: { value: 'Updated Title' } });

      // Should not save immediately
      expect(onUpdate).not.toHaveBeenCalled();

      // Fast-forward 1.5 seconds
      await act(async () => {
        vi.advanceTimersByTime(1500);
      });

      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Updated Title' })
      );
    });

    it('resets timer when content changes again', async () => {
      const onUpdate = vi.fn();
      render(<Editor {...defaultProps} onUpdate={onUpdate} />);

      const titleInput = screen.getByDisplayValue('Test Note');

      // First change
      fireEvent.change(titleInput, { target: { value: 'First' } });

      // Wait 1 second
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Second change - should reset timer
      fireEvent.change(titleInput, { target: { value: 'Second' } });

      // Wait another 1 second (should not save yet - timer was reset)
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      expect(onUpdate).not.toHaveBeenCalled();

      // Wait remaining time
      await act(async () => {
        vi.advanceTimersByTime(500);
      });
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Second' })
      );
    });
  });

  describe('delete confirmation', () => {
    it('shows delete confirmation when delete button clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<Editor {...defaultProps} />);

      await user.click(screen.getByLabelText('Delete note'));

      expect(screen.getByText('Delete this note?')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    });

    it('hides confirmation when Cancel clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<Editor {...defaultProps} />);

      await user.click(screen.getByLabelText('Delete note'));
      await user.click(screen.getByText('Cancel'));

      expect(screen.queryByText('Delete this note?')).not.toBeInTheDocument();
    });

    it('calls onDelete when Delete confirmed', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onDelete = vi.fn();
      render(<Editor {...defaultProps} onDelete={onDelete} />);

      await user.click(screen.getByLabelText('Delete note'));
      await user.click(screen.getByRole('button', { name: 'Delete' }));

      expect(onDelete).toHaveBeenCalledWith('note-123');
    });

    it('closes confirmation when clicking backdrop', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<Editor {...defaultProps} />);

      await user.click(screen.getByLabelText('Delete note'));

      // Click backdrop
      const backdrop = screen.getByText('Delete this note?').closest('.fixed');
      if (backdrop) {
        fireEvent.click(backdrop);
      }

      expect(screen.queryByText('Delete this note?')).not.toBeInTheDocument();
    });
  });

  describe('export menu', () => {
    it('shows export menu when export button clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<Editor {...defaultProps} />);

      await user.click(screen.getByLabelText('Export note'));

      expect(screen.getByText('Copy as text')).toBeInTheDocument();
      expect(screen.getByText('Copy with formatting')).toBeInTheDocument();
      expect(screen.getByText('Share as Letter')).toBeInTheDocument();
      expect(screen.getByText('Download (.md)')).toBeInTheDocument();
      expect(screen.getByText('Download (.json)')).toBeInTheDocument();
    });

    it('copies note as text', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<Editor {...defaultProps} />);

      await user.click(screen.getByLabelText('Export note'));
      await user.click(screen.getByText('Copy as text'));

      expect(exportImport.copyNoteToClipboard).toHaveBeenCalled();
    });

    it('copies note with formatting', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<Editor {...defaultProps} />);

      await user.click(screen.getByLabelText('Export note'));
      await user.click(screen.getByText('Copy with formatting'));

      expect(exportImport.copyNoteWithFormatting).toHaveBeenCalled();
    });

    it('downloads markdown', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<Editor {...defaultProps} />);

      await user.click(screen.getByLabelText('Export note'));
      await user.click(screen.getByText('Download (.md)'));

      expect(exportImport.exportNoteToMarkdown).toHaveBeenCalled();
      expect(exportImport.downloadFile).toHaveBeenCalled();
    });

    it('downloads JSON', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<Editor {...defaultProps} />);

      await user.click(screen.getByLabelText('Export note'));
      await user.click(screen.getByText('Download (.json)'));

      expect(exportImport.exportNoteToJSON).toHaveBeenCalled();
      expect(exportImport.downloadFile).toHaveBeenCalled();
    });

    it('opens share modal', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<Editor {...defaultProps} />);

      await user.click(screen.getByLabelText('Export note'));
      await user.click(screen.getByText('Share as Letter'));

      expect(screen.getByTestId('share-modal')).toBeInTheDocument();
    });

    it('closes export menu when clicking outside', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<Editor {...defaultProps} />);

      await user.click(screen.getByLabelText('Export note'));
      expect(screen.getByText('Copy as text')).toBeInTheDocument();

      // Click outside
      fireEvent.mouseDown(document.body);

      await waitFor(() => {
        expect(screen.queryByText('Copy as text')).not.toBeInTheDocument();
      });
    });
  });

  describe('navigation', () => {
    it('calls onBack when logo clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onBack = vi.fn();
      render(<Editor {...defaultProps} onBack={onBack} />);

      // Find the Zenote button in header
      const zenoteButtons = screen.getAllByText('Zenote');
      await user.click(zenoteButtons[0]);

      expect(onBack).toHaveBeenCalled();
    });

    it('calls onBack when Return to notes clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onBack = vi.fn();
      render(<Editor {...defaultProps} onBack={onBack} />);

      await user.click(screen.getByText('Return to notes'));

      expect(onBack).toHaveBeenCalled();
    });

    it('calls onBack when whisper back clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onBack = vi.fn();
      render(<Editor {...defaultProps} onBack={onBack} />);

      await user.click(screen.getByTestId('whisper-back'));

      expect(onBack).toHaveBeenCalled();
    });
  });

  describe('keyboard shortcuts', () => {
    it('saves and goes back on Escape', async () => {
      const onBack = vi.fn();
      const onUpdate = vi.fn();
      render(<Editor {...defaultProps} onBack={onBack} onUpdate={onUpdate} />);

      // Make a change first
      const titleInput = screen.getByDisplayValue('Test Note');
      fireEvent.change(titleInput, { target: { value: 'Changed' } });

      // Press Escape
      fireEvent.keyDown(window, { key: 'Escape' });

      expect(onUpdate).toHaveBeenCalled();
      expect(onBack).toHaveBeenCalled();
    });

    it('copies note on Cmd+Shift+C', async () => {
      render(<Editor {...defaultProps} />);

      fireEvent.keyDown(window, {
        key: 'c',
        metaKey: true,
        shiftKey: true
      });

      await waitFor(() => {
        expect(exportImport.copyNoteToClipboard).toHaveBeenCalled();
      });
    });
  });

  describe('save status indicator', () => {
    it('shows saving indicator during save', async () => {
      render(<Editor {...defaultProps} />);

      const titleInput = screen.getByDisplayValue('Test Note');
      fireEvent.change(titleInput, { target: { value: 'Changed' } });

      // Trigger save
      await act(async () => {
        vi.advanceTimersByTime(1500);
      });

      // Should show "Saving..." initially
      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });

    it('shows saved indicator after save completes', async () => {
      render(<Editor {...defaultProps} />);

      const titleInput = screen.getByDisplayValue('Test Note');
      fireEvent.change(titleInput, { target: { value: 'Changed' } });

      // Trigger save and wait for "Saved" transition
      await act(async () => {
        vi.advanceTimersByTime(1500); // Trigger save
      });

      await act(async () => {
        vi.advanceTimersByTime(500); // Wait for "Saved" state
      });

      expect(screen.getByText('Saved')).toBeInTheDocument();
    });
  });

  describe('tag creation', () => {
    it('calls onCreateTag when create tag clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onCreateTag = vi.fn();
      render(<Editor {...defaultProps} onCreateTag={onCreateTag} />);

      await user.click(screen.getByText('Create Tag'));

      expect(onCreateTag).toHaveBeenCalled();
    });
  });
});
