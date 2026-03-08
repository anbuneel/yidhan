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
  WhisperBack: () => (
    <button data-testid="whisper-back">Scroll to top</button>
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
    onUpdate: vi.fn().mockResolvedValue(undefined),
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
      expect(screen.getByTestId('header-left')).toHaveTextContent('Yidhan');
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
    it('triggers save after 800ms of inactivity', async () => {
      const onUpdate = vi.fn().mockResolvedValue(undefined);
      render(<Editor {...defaultProps} onUpdate={onUpdate} />);

      const titleInput = screen.getByDisplayValue('Test Note');
      fireEvent.change(titleInput, { target: { value: 'Updated Title' } });

      // Should not save immediately
      expect(onUpdate).not.toHaveBeenCalled();

      // Fast-forward 800ms
      await act(async () => {
        vi.advanceTimersByTime(800);
      });

      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Updated Title' })
      );
    });

    it('resets timer when content changes again', async () => {
      const onUpdate = vi.fn().mockResolvedValue(undefined);
      render(<Editor {...defaultProps} onUpdate={onUpdate} />);

      const titleInput = screen.getByDisplayValue('Test Note');

      // First change
      fireEvent.change(titleInput, { target: { value: 'First' } });

      // Wait 500ms (within debounce)
      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      // Second change - should reset timer
      fireEvent.change(titleInput, { target: { value: 'Second' } });

      // Wait another 500ms (should not save yet - timer was reset, only 500ms of 800ms)
      await act(async () => {
        vi.advanceTimersByTime(500);
      });
      expect(onUpdate).not.toHaveBeenCalled();

      // Wait remaining time (300ms to reach 800ms from last change)
      await act(async () => {
        vi.advanceTimersByTime(300);
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
      // E2EE sharing re-enabled — share option should be visible
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

    it('share option is visible with E2EE sharing enabled', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<Editor {...defaultProps} />);

      await user.click(screen.getByLabelText('Export note'));

      // E2EE sharing re-enabled — share option should be visible
      expect(screen.getByText('Share as Letter')).toBeInTheDocument();
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

      // Find the Yidhan button in header
      const yidhanButtons = screen.getAllByText('Yidhan');
      await user.click(yidhanButtons[0]);

      expect(onBack).toHaveBeenCalled();
    });

    it('calls onBack when Return to notes clicked', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onBack = vi.fn();
      render(<Editor {...defaultProps} onBack={onBack} />);

      await user.click(screen.getByText('Return to notes'));

      expect(onBack).toHaveBeenCalled();
    });

    it('renders whisper back button for scrolling to top', () => {
      render(<Editor {...defaultProps} />);

      // WhisperBack is rendered for scrolling back to top of long notes
      expect(screen.getByTestId('whisper-back')).toBeInTheDocument();
    });
  });

  describe('keyboard shortcuts', () => {
    it('saves and goes back on Escape', async () => {
      const onBack = vi.fn();
      const onUpdate = vi.fn().mockResolvedValue(undefined);
      render(<Editor {...defaultProps} onBack={onBack} onUpdate={onUpdate} />);

      // Make a change first
      const titleInput = screen.getByDisplayValue('Test Note');
      fireEvent.change(titleInput, { target: { value: 'Changed' } });

      // Press Escape - now async, await the save before checking
      fireEvent.keyDown(window, { key: 'Escape' });

      // Wait for the async save and navigation to complete
      await waitFor(() => {
        expect(onUpdate).toHaveBeenCalled();
        expect(onBack).toHaveBeenCalled();
      });
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
      // Use a deferred promise to control when save completes
      let resolveSave: () => void;
      const savePromise = new Promise<void>((resolve) => {
        resolveSave = resolve;
      });
      const onUpdate = vi.fn().mockReturnValue(savePromise);

      render(<Editor {...defaultProps} onUpdate={onUpdate} />);

      const titleInput = screen.getByDisplayValue('Test Note');
      fireEvent.change(titleInput, { target: { value: 'Changed' } });

      // Trigger save (debounce timeout)
      await act(async () => {
        vi.advanceTimersByTime(1500);
      });

      // Should show "Saving..." while save is in progress
      expect(screen.getByText('Saving...')).toBeInTheDocument();

      // Resolve the save
      await act(async () => {
        resolveSave!();
      });
    });

    it('shows saved indicator after save completes', async () => {
      render(<Editor {...defaultProps} />);

      const titleInput = screen.getByDisplayValue('Test Note');
      fireEvent.change(titleInput, { target: { value: 'Changed' } });

      // Trigger save
      await act(async () => {
        vi.advanceTimersByTime(1500);
      });

      // Wait for promise to resolve and state to update
      await act(async () => {
        await Promise.resolve();
      });

      expect(screen.getByText('Saved')).toBeInTheDocument();
    });

    it('shows error indicator when save fails', async () => {
      const onUpdate = vi.fn().mockRejectedValue(new Error('Save failed'));

      render(<Editor {...defaultProps} onUpdate={onUpdate} />);

      const titleInput = screen.getByDisplayValue('Test Note');
      fireEvent.change(titleInput, { target: { value: 'Changed' } });

      // Trigger save
      await act(async () => {
        vi.advanceTimersByTime(1500);
      });

      // Wait for promise to reject and state to update
      await act(async () => {
        await Promise.resolve();
      });

      expect(screen.getByText('Save failed')).toBeInTheDocument();
    });
  });

  describe('sync confirmation indicator', () => {
    it('shows "Saved" when noteSyncStatus transitions from pending to synced', async () => {
      const { rerender } = render(
        <Editor {...defaultProps} noteSyncStatus="pending" />
      );

      // Wait for initial save status to settle to idle
      await act(async () => {
        vi.advanceTimersByTime(2500);
      });

      // Transition to synced
      rerender(<Editor {...defaultProps} noteSyncStatus="synced" />);

      expect(screen.getByText('Saved')).toBeInTheDocument();
    });

    it('does not show "Saved" if noteSyncStatus was already synced (no transition)', async () => {
      const { rerender } = render(
        <Editor {...defaultProps} noteSyncStatus="synced" />
      );

      // Re-render with same status — no transition
      rerender(<Editor {...defaultProps} noteSyncStatus="synced" />);

      // Should not show saved indicator (no pending→synced transition occurred)
      expect(screen.queryByText('Saved')).not.toBeInTheDocument();
    });

    it('does not show "Saved" during active save (saveStatus is saving)', async () => {
      // Start with a save in progress
      let resolveSave: () => void;
      const savePromise = new Promise<void>((resolve) => {
        resolveSave = resolve;
      });
      const onUpdate = vi.fn().mockReturnValue(savePromise);

      const { rerender } = render(
        <Editor {...defaultProps} onUpdate={onUpdate} noteSyncStatus="pending" />
      );

      // Trigger a save to put editor in 'saving' state
      const titleInput = screen.getByDisplayValue('Test Note');
      fireEvent.change(titleInput, { target: { value: 'Changed' } });

      await act(async () => {
        vi.advanceTimersByTime(800);
      });

      expect(screen.getByText('Saving...')).toBeInTheDocument();

      // Now transition sync status — should NOT override the 'Saving...' indicator
      rerender(
        <Editor {...defaultProps} onUpdate={onUpdate} noteSyncStatus="synced" />
      );

      // Still showing Saving... not Saved
      expect(screen.getByText('Saving...')).toBeInTheDocument();

      // Cleanup
      await act(async () => {
        resolveSave!();
      });
    });

    it('auto-hides "Saved" indicator after 2 seconds', async () => {
      const { rerender } = render(
        <Editor {...defaultProps} noteSyncStatus="pending" />
      );

      // Wait for initial state to settle to idle
      await act(async () => {
        vi.advanceTimersByTime(2500);
      });

      rerender(<Editor {...defaultProps} noteSyncStatus="synced" />);

      expect(screen.getByText('Saved')).toBeInTheDocument();

      // Advance 2 seconds
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      expect(screen.queryByText('Saved')).not.toBeInTheDocument();
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

  describe('remote update detection (2B)', () => {
    it('silently updates editor when remote change arrives on clean editor', async () => {
      const { rerender } = render(<Editor {...defaultProps} />);

      // Verify initial state
      expect(screen.getByDisplayValue('Test Note')).toBeInTheDocument();

      // Simulate remote change arriving via prop update (clean editor — no local edits)
      const updatedNote = createMockNote({
        id: 'note-123',
        title: 'Remote Title',
        content: '<p>Remote content</p>',
        tags: [createMockTag({ id: 'tag-1', name: 'Work' })],
      });
      rerender(<Editor {...defaultProps} note={updatedNote} />);

      // Should silently update — no banner shown
      expect(screen.queryByText('Updated on another device')).not.toBeInTheDocument();
      expect(screen.getByDisplayValue('Remote Title')).toBeInTheDocument();
    });

    it('shows banner when remote change arrives on dirty editor', async () => {
      const onUpdate = vi.fn().mockResolvedValue(undefined);
      const { rerender } = render(<Editor {...defaultProps} onUpdate={onUpdate} />);

      // Make a local edit (dirty the editor)
      const titleInput = screen.getByDisplayValue('Test Note');
      fireEvent.change(titleInput, { target: { value: 'My Local Edit' } });

      // Simulate remote change arriving via prop update
      const updatedNote = createMockNote({
        id: 'note-123',
        title: 'Remote Title',
        content: '<p>Remote content</p>',
        tags: [createMockTag({ id: 'tag-1', name: 'Work' })],
      });
      rerender(<Editor {...defaultProps} note={updatedNote} onUpdate={onUpdate} />);

      // Should show the conflict banner
      expect(screen.getByText('Updated on another device')).toBeInTheDocument();
      expect(screen.getByText('Keep mine')).toBeInTheDocument();
      expect(screen.getByText('Load changes')).toBeInTheDocument();
    });

    it('does not show banner for self-echo (own save returning via props)', async () => {
      const onUpdate = vi.fn().mockResolvedValue(undefined);
      const { rerender } = render(<Editor {...defaultProps} onUpdate={onUpdate} />);

      // Make a local edit
      const titleInput = screen.getByDisplayValue('Test Note');
      fireEvent.change(titleInput, { target: { value: 'My Edit' } });

      // Trigger auto-save
      await act(async () => {
        vi.advanceTimersByTime(800);
      });

      // Wait for the save to complete (updates lastSaved refs)
      await act(async () => {
        await Promise.resolve();
      });

      expect(onUpdate).toHaveBeenCalled();

      // Now simulate the note prop updating to match what we just saved (self-echo)
      const echoedNote = createMockNote({
        id: 'note-123',
        title: 'My Edit',
        content: '<p>Test content</p>',
        tags: [createMockTag({ id: 'tag-1', name: 'Work' })],
      });
      rerender(<Editor {...defaultProps} note={echoedNote} onUpdate={onUpdate} />);

      // Should NOT show the banner — it's our own save echoing back
      expect(screen.queryByText('Updated on another device')).not.toBeInTheDocument();
    });

    it('"Load changes" applies remote content and dismisses banner', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onUpdate = vi.fn().mockResolvedValue(undefined);
      const { rerender } = render(<Editor {...defaultProps} onUpdate={onUpdate} />);

      // Dirty the editor
      const titleInput = screen.getByDisplayValue('Test Note');
      fireEvent.change(titleInput, { target: { value: 'My Local Edit' } });

      // Remote change arrives
      const updatedNote = createMockNote({
        id: 'note-123',
        title: 'Remote Title',
        content: '<p>Remote content</p>',
        tags: [createMockTag({ id: 'tag-1', name: 'Work' })],
      });
      rerender(<Editor {...defaultProps} note={updatedNote} onUpdate={onUpdate} />);

      // Click "Load changes"
      await user.click(screen.getByText('Load changes'));

      // Banner should be gone, title should be remote
      expect(screen.queryByText('Updated on another device')).not.toBeInTheDocument();
      expect(screen.getByDisplayValue('Remote Title')).toBeInTheDocument();
    });

    it('"Keep mine" dismisses banner and prevents reappearance', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onUpdate = vi.fn().mockResolvedValue(undefined);
      const { rerender } = render(<Editor {...defaultProps} onUpdate={onUpdate} />);

      // Dirty the editor
      const titleInput = screen.getByDisplayValue('Test Note');
      fireEvent.change(titleInput, { target: { value: 'My Local Edit' } });

      // Remote change arrives
      const remoteNote = createMockNote({
        id: 'note-123',
        title: 'Remote Title',
        content: '<p>Remote content</p>',
        tags: [createMockTag({ id: 'tag-1', name: 'Work' })],
      });
      rerender(<Editor {...defaultProps} note={remoteNote} onUpdate={onUpdate} />);
      expect(screen.getByText('Updated on another device')).toBeInTheDocument();

      // Click "Keep mine"
      await user.click(screen.getByText('Keep mine'));

      // Banner should be gone, local edit should remain
      expect(screen.queryByText('Updated on another device')).not.toBeInTheDocument();
      expect(screen.getByDisplayValue('My Local Edit')).toBeInTheDocument();

      // Simulate another rehydration with the SAME remote content
      // (e.g., sync pulls remote changes again)
      rerender(<Editor {...defaultProps} note={remoteNote} onUpdate={onUpdate} />);

      // Banner should NOT reappear — this version was already dismissed
      expect(screen.queryByText('Updated on another device')).not.toBeInTheDocument();
    });

    it('does not show false banner during own save (optimistic update race)', async () => {
      // This tests the fix for finding #2: the optimistic setNotes() in
      // handleNoteUpdate can trigger a re-render before lastSaved refs
      // were updated. The fix moves ref updates before the async call.
      const onUpdate = vi.fn().mockImplementation(async (updatedNote: unknown) => {
        // Simulate what handleNoteUpdate does: nothing observable here,
        // but the key is that onUpdate is async
        await Promise.resolve();
        return updatedNote;
      });

      const { rerender } = render(<Editor {...defaultProps} onUpdate={onUpdate} />);

      // Make a local edit
      const titleInput = screen.getByDisplayValue('Test Note');
      fireEvent.change(titleInput, { target: { value: 'Saving This' } });

      // Trigger auto-save
      await act(async () => {
        vi.advanceTimersByTime(800);
      });

      // Simulate the optimistic update arriving as a prop change
      // WHILE the save is still in flight
      const optimisticNote = createMockNote({
        id: 'note-123',
        title: 'Saving This',
        content: '<p>Test content</p>',
        tags: [createMockTag({ id: 'tag-1', name: 'Work' })],
      });
      rerender(<Editor {...defaultProps} note={optimisticNote} onUpdate={onUpdate} />);

      // Should NOT show the banner — this is our own save, not a remote update
      expect(screen.queryByText('Updated on another device')).not.toBeInTheDocument();
    });
  });
});
