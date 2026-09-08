import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChapteredLibrary } from './ChapteredLibrary';
import { createMockNote } from '../test/factories';

// Mock the two grouping functions, keeping the module's real vocabulary — the arrange
// controls read their option lists from it.
vi.mock('../utils/temporalGrouping', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../utils/temporalGrouping')>()),
  groupNotesByChapter: vi.fn(),
  getDefaultExpansionState: vi.fn(),
}));

// Import after mocking
import * as temporalGrouping from '../utils/temporalGrouping';

// Mock child components
vi.mock('./ChapterSection', () => ({
  ChapterSection: ({
    chapterKey,
    label,
    notes,
    onNoteClick,
    onNoteDelete,
    onTogglePin,
  }: {
    chapterKey: string;
    label: string;
    notes: { id: string }[];
    onNoteClick: (id: string) => void;
    onNoteDelete: (id: string) => void;
    onTogglePin: (id: string, pinned: boolean) => void;
  }) => (
    <div data-testid={`chapter-${chapterKey}`} id={`chapter-${chapterKey}`}>
      <h2>{label}</h2>
      <span data-testid={`${chapterKey}-count`}>{notes.length} notes</span>
      {notes.map((note) => (
        <div key={note.id} data-testid={`note-${note.id}`}>
          <button type="button" onClick={() => onNoteClick(note.id)}>Click {note.id}</button>
          <button type="button" onClick={() => onNoteDelete(note.id)}>Delete {note.id}</button>
          <button type="button" onClick={() => onTogglePin(note.id, true)}>Pin {note.id}</button>
        </div>
      ))}
    </div>
  ),
}));

vi.mock('./ChapterNav', () => ({
  ChapterNav: ({
    chapters,
    currentChapter,
    onChapterClick,
  }: {
    chapters: { key: string; label: string }[];
    currentChapter: string | null;
    onChapterClick: (key: string) => void;
  }) => (
    <nav data-testid="chapter-nav">
      {chapters.map((c) => (
        <button type="button"
          key={c.key}
          data-testid={`nav-${c.key}`}
          data-current={currentChapter === c.key}
          onClick={() => onChapterClick(c.key)}
        >
          {c.label}
        </button>
      ))}
    </nav>
  ),
}));

vi.mock('./TimeRibbon', () => ({
  TimeRibbon: ({
    chapters,
    currentChapter,
    onChapterClick,
  }: {
    chapters: { key: string; label: string }[];
    currentChapter: string | null;
    onChapterClick: (key: string) => void;
  }) => (
    <div data-testid="time-ribbon">
      {chapters.map((c) => (
        <button type="button"
          key={c.key}
          data-testid={`ribbon-${c.key}`}
          data-current={currentChapter === c.key}
          onClick={() => onChapterClick(c.key)}
        >
          {c.label}
        </button>
      ))}
    </div>
  ),
}));

describe('ChapteredLibrary', () => {
  const defaultProps = {
    notes: [],
    onNoteClick: vi.fn(),
    onNoteDelete: vi.fn(),
    onTogglePin: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Set default mock implementations
    vi.mocked(temporalGrouping.groupNotesByChapter).mockReturnValue([]);
    vi.mocked(temporalGrouping.getDefaultExpansionState).mockReturnValue({
      pinned: true,
      thisWeek: true,
      lastWeek: false,
      thisMonth: false,
      earlier: false,
      archive: false,
    });
  });

  describe('empty state', () => {
    it('shows empty state with create button when no notes', () => {
      const onNewNote = vi.fn();
      render(<ChapteredLibrary {...defaultProps} onNewNote={onNewNote} />);

      expect(screen.getByText('Your notes await')).toBeInTheDocument();
      expect(screen.getByText('A quiet space for your thoughts')).toBeInTheDocument();
      expect(screen.getByText('Create your first note')).toBeInTheDocument();
    });

    it('calls onNewNote when create button clicked', async () => {
      const user = userEvent.setup({ delay: null });
      const onNewNote = vi.fn();
      render(<ChapteredLibrary {...defaultProps} onNewNote={onNewNote} />);

      await user.click(screen.getByText('Create your first note'));

      expect(onNewNote).toHaveBeenCalled();
    });

    it('does not show create button when onNewNote not provided', () => {
      render(<ChapteredLibrary {...defaultProps} />);

      expect(screen.getByText('Your notes await')).toBeInTheDocument();
      expect(screen.queryByText('Create your first note')).not.toBeInTheDocument();
    });

    it('shows keyboard shortcut hint', () => {
      render(<ChapteredLibrary {...defaultProps} onNewNote={vi.fn()} />);

      expect(screen.getByText('N')).toBeInTheDocument();
    });

    it('shows normal empty state even when search is active with no notes', () => {
      render(<ChapteredLibrary {...defaultProps} searchQuery="nonexistent" />);

      // With 0 notes, shows the standard empty state (focused-gaze search only applies when notes exist)
      expect(screen.getByText('Your notes await')).toBeInTheDocument();
    });

    it('keeps the library surface quiet while notes are loading', () => {
      render(<ChapteredLibrary {...defaultProps} isLoading />);

      expect(screen.getByTestId('library-view')).toHaveAttribute('aria-busy', 'true');
      expect(screen.queryByText('Your notes await')).not.toBeInTheDocument();
      expect(screen.queryByText('Create your first note')).not.toBeInTheDocument();
    });
  });

  describe('with notes', () => {
    const mockNotes = [
      createMockNote({ id: 'note-1', title: 'Note 1', pinned: true }),
      createMockNote({ id: 'note-2', title: 'Note 2' }),
      createMockNote({ id: 'note-3', title: 'Note 3' }),
    ];

    const mockChapters = [
      { key: 'pinned', label: 'Pinned', notes: [mockNotes[0]], isPinned: true },
      { key: 'thisWeek', label: 'This Week', notes: [mockNotes[1], mockNotes[2]], isPinned: false },
    ];

    beforeEach(() => {
      vi.mocked(temporalGrouping.groupNotesByChapter).mockReturnValue(mockChapters);
      vi.mocked(temporalGrouping.getDefaultExpansionState).mockReturnValue({
        pinned: true,
        thisWeek: true,
        lastWeek: false,
        thisMonth: false,
        earlier: false,
        archive: false,
      });
    });

    it('renders chapter sections', () => {
      render(<ChapteredLibrary {...defaultProps} notes={mockNotes} />);

      expect(screen.getByTestId('chapter-pinned')).toBeInTheDocument();
      expect(screen.getByTestId('chapter-thisWeek')).toBeInTheDocument();
      // Use getAllByText since text appears in multiple elements (h2, nav, ribbon)
      expect(screen.getAllByText('Pinned').length).toBeGreaterThan(0);
      expect(screen.getAllByText('This Week').length).toBeGreaterThan(0);
    });

    it('renders correct note counts per chapter', () => {
      render(<ChapteredLibrary {...defaultProps} notes={mockNotes} />);

      expect(screen.getByTestId('pinned-count')).toHaveTextContent('1 notes');
      expect(screen.getByTestId('thisWeek-count')).toHaveTextContent('2 notes');
    });

    it('renders ChapterNav with chapters', () => {
      render(<ChapteredLibrary {...defaultProps} notes={mockNotes} />);

      expect(screen.getByTestId('chapter-nav')).toBeInTheDocument();
      expect(screen.getByTestId('nav-pinned')).toBeInTheDocument();
      expect(screen.getByTestId('nav-thisWeek')).toBeInTheDocument();
    });

    it('renders TimeRibbon with chapters', () => {
      render(<ChapteredLibrary {...defaultProps} notes={mockNotes} />);

      expect(screen.getByTestId('time-ribbon')).toBeInTheDocument();
      expect(screen.getByTestId('ribbon-pinned')).toBeInTheDocument();
      expect(screen.getByTestId('ribbon-thisWeek')).toBeInTheDocument();
    });

    it('calls onNoteClick when note is clicked', async () => {
      const user = userEvent.setup({ delay: null });
      const onNoteClick = vi.fn();
      render(
        <ChapteredLibrary {...defaultProps} notes={mockNotes} onNoteClick={onNoteClick} />
      );

      await user.click(screen.getByText('Click note-1'));

      expect(onNoteClick).toHaveBeenCalledWith('note-1');
    });

    it('calls onNoteDelete when note delete is clicked', async () => {
      const user = userEvent.setup({ delay: null });
      const onNoteDelete = vi.fn();
      render(
        <ChapteredLibrary {...defaultProps} notes={mockNotes} onNoteDelete={onNoteDelete} />
      );

      await user.click(screen.getByText('Delete note-2'));

      expect(onNoteDelete).toHaveBeenCalledWith('note-2');
    });

    it('calls onTogglePin when note pin is clicked', async () => {
      const user = userEvent.setup({ delay: null });
      const onTogglePin = vi.fn();
      render(
        <ChapteredLibrary {...defaultProps} notes={mockNotes} onTogglePin={onTogglePin} />
      );

      await user.click(screen.getByText('Pin note-3'));

      expect(onTogglePin).toHaveBeenCalledWith('note-3', true);
    });

    it('scrolls to chapter when nav is clicked', async () => {
      const user = userEvent.setup({ delay: null });
      const scrollIntoViewMock = vi.fn();

      render(<ChapteredLibrary {...defaultProps} notes={mockNotes} />);

      // Mock scrollIntoView on the chapter element
      const chapterElement = screen.getByTestId('chapter-thisWeek');
      chapterElement.scrollIntoView = scrollIntoViewMock;

      await user.click(screen.getByTestId('nav-thisWeek'));

      expect(scrollIntoViewMock).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'start',
      });
    });

    it('scrolls to chapter when time ribbon is clicked', async () => {
      const user = userEvent.setup({ delay: null });
      const scrollIntoViewMock = vi.fn();

      render(<ChapteredLibrary {...defaultProps} notes={mockNotes} />);

      // Mock scrollIntoView on the chapter element
      const chapterElement = screen.getByTestId('chapter-pinned');
      chapterElement.scrollIntoView = scrollIntoViewMock;

      await user.click(screen.getByTestId('ribbon-pinned'));

      expect(scrollIntoViewMock).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'start',
      });
    });

    it('uses a single IntersectionObserver for all chapters', () => {
      const observerSpy = vi.spyOn(window, 'IntersectionObserver');
      render(<ChapteredLibrary {...defaultProps} notes={mockNotes} />);

      expect(observerSpy).toHaveBeenCalledTimes(1);

      // Verify observe was called for each chapter
      // We need to access the mock instance returned by the constructor
      const observerInstance = observerSpy.mock.results[0].value;

      // There are 2 chapters in mockChapters (pinned and thisWeek)
      expect(observerInstance.observe).toHaveBeenCalledTimes(2);
    });
  });

  describe('chapter grouping', () => {
    it('calls groupNotesByChapter with notes as provided', () => {
      const olderNote = createMockNote({
        id: 'old',
        updatedAt: new Date('2024-01-01'),
      });
      const newerNote = createMockNote({
        id: 'new',
        updatedAt: new Date('2024-12-01'),
      });

      vi.mocked(temporalGrouping.groupNotesByChapter).mockReturnValue([]);
      vi.mocked(temporalGrouping.getDefaultExpansionState).mockReturnValue({
        pinned: true,
        thisWeek: true,
        lastWeek: false,
        thisMonth: false,
        earlier: false,
        archive: false,
      });

      // Pass notes sorted (as App.tsx would provide them)
      render(
        <ChapteredLibrary {...defaultProps} notes={[newerNote, olderNote]} />
      );

      expect(temporalGrouping.groupNotesByChapter).toHaveBeenCalled();
      const callArg = vi.mocked(temporalGrouping.groupNotesByChapter).mock.calls[0][0];
      expect(callArg[0].id).toBe('new');
      expect(callArg[1].id).toBe('old');
    });

    it('passes the reader’s arrangement to the grouping', () => {
      render(
        <ChapteredLibrary
          {...defaultProps}
          notes={[createMockNote({ id: '1' })]}
          arrangement={{ basis: 'created', sort: 'title' }}
        />
      );

      expect(temporalGrouping.groupNotesByChapter).toHaveBeenCalledWith(
        expect.anything(),
        { basis: 'created', sort: 'title' }
      );
    });

    it('groups by last edited when no arrangement is given', () => {
      render(<ChapteredLibrary {...defaultProps} notes={[createMockNote({ id: '1' })]} />);

      expect(temporalGrouping.groupNotesByChapter).toHaveBeenCalledWith(
        expect.anything(),
        { basis: 'updated', sort: 'updated' }
      );
    });
  });

  describe('arrange controls', () => {
    const notes = [createMockNote({ id: '1' })];

    const arrangeProps = {
      arrangement: { basis: 'updated' as const, sort: 'updated' as const },
      onBasisChange: vi.fn(),
      onSortChange: vi.fn(),
    };

    beforeEach(() => {
      vi.mocked(temporalGrouping.groupNotesByChapter).mockReturnValue([
        { key: 'thisWeek', label: 'This Week', notes },
      ]);
    });

    it('offers the basis and order choices', () => {
      render(<ChapteredLibrary {...defaultProps} notes={notes} {...arrangeProps} />);

      expect(screen.getByRole('group', { name: 'Group chapters by' })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'Order notes by' })).toBeInTheDocument();
    });

    it('marks the current choice as pressed', () => {
      render(
        <ChapteredLibrary
          {...defaultProps}
          notes={notes}
          {...arrangeProps}
          arrangement={{ basis: 'created', sort: 'title' }}
        />
      );

      // Both groups offer "Edited"; the spoken name has to say which one is meant.
      expect(
        screen.getByRole('button', { name: 'Group chapters by written', pressed: true })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Group chapters by edited', pressed: false })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Order notes by title', pressed: true })
      ).toBeInTheDocument();
    });

    it('reports a basis choice without touching the order', async () => {
      const onBasisChange = vi.fn();
      const onSortChange = vi.fn();
      const user = userEvent.setup();
      render(
        <ChapteredLibrary
          {...defaultProps}
          notes={notes}
          {...arrangeProps}
          onBasisChange={onBasisChange}
          onSortChange={onSortChange}
        />
      );

      await user.click(screen.getByRole('button', { name: 'Group chapters by written' }));

      expect(onBasisChange).toHaveBeenCalledWith('created');
      expect(onSortChange).not.toHaveBeenCalled();
    });

    it('reports an order choice without touching the basis', async () => {
      const onBasisChange = vi.fn();
      const onSortChange = vi.fn();
      const user = userEvent.setup();
      render(
        <ChapteredLibrary
          {...defaultProps}
          notes={notes}
          {...arrangeProps}
          onBasisChange={onBasisChange}
          onSortChange={onSortChange}
        />
      );

      await user.click(screen.getByRole('button', { name: 'Order notes by title' }));

      expect(onSortChange).toHaveBeenCalledWith('title');
      expect(onBasisChange).not.toHaveBeenCalled();
    });

    it('stays out of the way when the reader cannot change the arrangement', () => {
      render(<ChapteredLibrary {...defaultProps} notes={notes} />);

      expect(screen.queryByRole('group', { name: 'Group chapters by' })).not.toBeInTheDocument();
    });

    it('does not offer arranging an empty library', () => {
      vi.mocked(temporalGrouping.groupNotesByChapter).mockReturnValue([]);

      render(<ChapteredLibrary {...defaultProps} notes={[]} {...arrangeProps} />);

      expect(screen.queryByRole('group', { name: 'Group chapters by' })).not.toBeInTheDocument();
      expect(screen.getByText('Your notes await')).toBeInTheDocument();
    });

    it('does not offer arranging a search that found nothing', () => {
      vi.mocked(temporalGrouping.groupNotesByChapter).mockReturnValue([]);

      render(<ChapteredLibrary {...defaultProps} notes={[]} isSearching {...arrangeProps} />);

      expect(screen.queryByRole('group', { name: 'Group chapters by' })).not.toBeInTheDocument();
    });

    it('does not offer arranging a library that has not loaded yet', () => {
      vi.mocked(temporalGrouping.groupNotesByChapter).mockReturnValue([]);

      render(<ChapteredLibrary {...defaultProps} notes={[]} isLoading {...arrangeProps} />);

      expect(screen.queryByRole('group', { name: 'Group chapters by' })).not.toBeInTheDocument();
    });

    it('still offers arranging while a search is showing matches', () => {
      render(
        <ChapteredLibrary {...defaultProps} notes={notes} isSearching searchQuery="k" {...arrangeProps} />
      );

      expect(screen.getByRole('group', { name: 'Group chapters by' })).toBeInTheDocument();
    });
  });

  describe('expansion state', () => {
    it('calls getDefaultExpansionState with note count', () => {
      const notes = [
        createMockNote({ id: '1' }),
        createMockNote({ id: '2' }),
        createMockNote({ id: '3' }),
      ];

      vi.mocked(temporalGrouping.groupNotesByChapter).mockReturnValue([]);
      vi.mocked(temporalGrouping.getDefaultExpansionState).mockReturnValue({
        pinned: true,
        thisWeek: true,
        lastWeek: false,
        thisMonth: false,
        earlier: false,
        archive: false,
      });

      render(<ChapteredLibrary {...defaultProps} notes={notes} />);

      expect(temporalGrouping.getDefaultExpansionState).toHaveBeenCalledWith(3);
    });
  });

  // Note: IntersectionObserver behavior is tested implicitly via the global mock in test/setup.ts
  // The nav click tests verify scroll-to-chapter behavior which relies on the observer updating currentChapter
});
