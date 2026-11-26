import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, renderHook, screen, act, fireEvent } from '@testing-library/react';
import { useSoftPrompt } from './useSoftPrompt';
import { useDemoState } from './useDemoState';
import {
  DEMO_STORAGE_KEY,
  countPracticeWork,
  createDemoNote,
  createDemoStarterPreviewState,
  updateDemoNote,
  type DemoMetadata,
  type DemoState,
} from '../services/demoStorage';
import { DemoPage } from '../pages/DemoPage';

function seedDemoState(mutate?: (state: DemoState) => void): DemoState {
  const state = createDemoStarterPreviewState();
  mutate?.(state);
  localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
  return state;
}

const TEN_MINUTES_AGO = () => Date.now() - 10 * 60 * 1000;

describe('Practice Space sign-up prompt count and guards (B4)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('counts 0 for untouched starter notes, never 5', () => {
    const starters = createDemoStarterPreviewState().notes.map((n) => ({
      id: n.localId,
      title: n.title,
      content: n.content,
      pinned: n.pinned,
    }));

    expect(starters.length).toBeGreaterThanOrEqual(5);
    expect(countPracticeWork(starters)).toBe(0);

    const { result } = renderHook(() => useDemoState());
    expect(result.current.notes.length).toBeGreaterThanOrEqual(5);
    expect(result.current.userNoteCount).toBe(0);
  });

  it('counts only notes the visitor created or starter notes they edited', () => {
    seedDemoState();

    // Edit one starter note.
    updateDemoNote('starter-welcome', { content: '<p>Edited by visitor</p>' });
    // Create two new notes.
    createDemoNote({ title: 'First', content: '<p>One</p>', pinned: false, tagIds: [] });
    createDemoNote({ title: 'Second', content: '<p>Two</p>', pinned: false, tagIds: [] });

    const { result } = renderHook(() => useDemoState());
    expect(result.current.notes.length).toBe(7); // 5 starters + 2 created
    expect(result.current.userNoteCount).toBe(3); // 1 edited starter + 2 created
  });

  it('never shows the prompt to a visitor who changed nothing, even after 10 minutes', () => {
    const metadata: DemoMetadata = {
      createdAt: TEN_MINUTES_AGO(),
      lastVisit: Date.now(),
      totalNotesCreated: 5,
      promptDismissedAt: null,
      ribbonDismissedAt: null,
    };

    const { result } = renderHook(() =>
      useSoftPrompt({
        metadata,
        userNoteCount: 0,
        onDismissPrompt: vi.fn(),
        onDismissRibbon: vi.fn(),
      })
    );

    expect(result.current.shouldShowPrompt).toBe(false);
    expect(result.current.shouldShowInlineNudge).toBe(false);
    expect(result.current.noteCount).toBe(0);
  });

  it('shows the prompt once 3+ visitor notes exist and 5+ minutes have passed', () => {
    const metadata: DemoMetadata = {
      createdAt: TEN_MINUTES_AGO(),
      lastVisit: Date.now(),
      totalNotesCreated: 3,
      promptDismissedAt: null,
      ribbonDismissedAt: null,
    };

    const { result } = renderHook(() =>
      useSoftPrompt({
        metadata,
        userNoteCount: 3,
        onDismissPrompt: vi.fn(),
        onDismissRibbon: vi.fn(),
      })
    );

    expect(result.current.shouldShowPrompt).toBe(true);
    expect(result.current.noteCount).toBe(3);
  });

  it('does not open when suppressed (e.g. behind another dialog or in the editor)', () => {
    const metadata: DemoMetadata = {
      createdAt: TEN_MINUTES_AGO(),
      lastVisit: Date.now(),
      totalNotesCreated: 3,
      promptDismissedAt: null,
      ribbonDismissedAt: null,
    };

    const { result, rerender } = renderHook(
      ({ suppressed }) =>
        useSoftPrompt({
          metadata,
          userNoteCount: 3,
          suppressed,
          onDismissPrompt: vi.fn(),
          onDismissRibbon: vi.fn(),
        }),
      { initialProps: { suppressed: true } }
    );

    expect(result.current.shouldShowPrompt).toBe(false);

    rerender({ suppressed: false });
    expect(result.current.shouldShowPrompt).toBe(true);
  });

  it('counts 0 for untouched legacy starters and 1 when a legacy starter is edited', () => {
    const untouchedLegacyBooks = {
      id: 'starter-books',
      title: 'Book Recommendations',
      content: `<p>Books people keep telling me to read:</p>
<ul>
<li>Atomic Habits</li>
<li>The Almanack of Naval Ravikant</li>
<li>Four Thousand Weeks</li>
</ul>
<p>Started Four Thousand Weeks last night. The bit about how we'll never "get on top of everything" was oddly freeing.</p>`,
      pinned: false,
    };

    expect(countPracticeWork([untouchedLegacyBooks])).toBe(0);
    expect(
      countPracticeWork([{ ...untouchedLegacyBooks, content: '<p>My own list.</p>' }])
    ).toBe(1);
  });

  it('defers clearing isTyping on focusout so pointer clicks on other controls are not swallowed', () => {
    vi.useFakeTimers();
    const metadata: DemoMetadata = {
      createdAt: TEN_MINUTES_AGO(),
      lastVisit: Date.now(),
      totalNotesCreated: 4,
      promptDismissedAt: null,
      ribbonDismissedAt: null,
    };
    const onCardClick = vi.fn();

    function Probe() {
      const { shouldShowPrompt } = useSoftPrompt({
        metadata,
        userNoteCount: 4,
        onDismissPrompt: vi.fn(),
        onDismissRibbon: vi.fn(),
      });
      return (
        <div>
          <input aria-label="Search notes" />
          <button type="button" onClick={onCardClick}>Open note</button>
          {shouldShowPrompt && <div data-testid="prompt-open">Prompt</div>}
        </div>
      );
    }

    render(<Probe />);
    const input = screen.getByLabelText('Search notes');
    const cardBtn = screen.getByRole('button', { name: 'Open note' });

    act(() => {
      input.focus();
      fireEvent.focusIn(input);
    });
    expect(screen.queryByTestId('prompt-open')).toBeNull();

    // Pointer down blurs the input and focuses the target button before mouseup/click:
    // prompt must NOT mount synchronously during focusout or focusin(button).
    act(() => {
      fireEvent.focusOut(input, { relatedTarget: cardBtn });
      cardBtn.focus();
      fireEvent.focusIn(cardBtn);
    });
    expect(screen.queryByTestId('prompt-open')).toBeNull();

    fireEvent.click(cardBtn);
    expect(onCardClick).toHaveBeenCalledTimes(1);

    // After the short defer window, the prompt can open if focus is not back in an input.
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.getByTestId('prompt-open')).toBeInTheDocument();
  });

  it('recovers from stale isTyping when a focused input unmounts without firing focusout', () => {
    vi.useFakeTimers();
    const metadata: DemoMetadata = {
      createdAt: TEN_MINUTES_AGO(),
      lastVisit: Date.now(),
      totalNotesCreated: 4,
      promptDismissedAt: null,
      ribbonDismissedAt: null,
    };

    function UnmountInputProbe({ showInput }: { showInput: boolean }) {
      const { shouldShowPrompt } = useSoftPrompt({
        metadata,
        userNoteCount: 4,
        onDismissPrompt: vi.fn(),
        onDismissRibbon: vi.fn(),
      });
      return (
        <div>
          {showInput && <input aria-label="Temporary input" />}
          {shouldShowPrompt && <div data-testid="prompt-open">Prompt</div>}
        </div>
      );
    }

    const { rerender } = render(<UnmountInputProbe showInput />);
    const input = screen.getByLabelText('Temporary input');
    act(() => {
      input.focus();
      fireEvent.focusIn(input);
    });
    expect(screen.queryByTestId('prompt-open')).toBeNull();

    // Unmount the focused input directly without firing focusout (matches React view switch).
    rerender(<UnmountInputProbe showInput={false} />);
    expect(document.activeElement).toBe(document.body);

    // The minute interval (or next keydown/pointerdown) detects activeElement is no longer editable and recovers.
    act(() => {
      vi.advanceTimersByTime(60 * 1000);
    });
    expect(screen.getByTestId('prompt-open')).toBeInTheDocument();
  });

  it('disables DemoPage keyboard shortcuts (? and Cmd/Ctrl+N) while isAuthModalOpen is true', () => {
    seedDemoState();
    render(
      <DemoPage
        onSignUp={vi.fn()}
        onSignIn={vi.fn()}
        isAuthModalOpen
        theme="light"
        onThemeToggle={vi.fn()}
        onHomeClick={vi.fn()}
        onChangelogClick={vi.fn()}
        onRoadmapClick={vi.fn()}
        onPrivacyClick={vi.fn()}
        onTermsClick={vi.fn()}
        onSupportClick={vi.fn()}
      />
    );

    fireEvent.keyDown(window, { key: '?' });
    expect(screen.queryByText('Quiet shortcuts')).toBeNull();

    fireEvent.keyDown(window, { key: 'n', ctrlKey: true });
    expect(screen.queryByTestId('note-editor')).toBeNull();
  });

  it('does not open while the visitor is typing inside an input or editable control', () => {
    vi.useFakeTimers();
    const metadata: DemoMetadata = {
      createdAt: TEN_MINUTES_AGO(),
      lastVisit: Date.now(),
      totalNotesCreated: 4,
      promptDismissedAt: null,
      ribbonDismissedAt: null,
    };

    function Probe() {
      const { shouldShowPrompt } = useSoftPrompt({
        metadata,
        userNoteCount: 4,
        onDismissPrompt: vi.fn(),
        onDismissRibbon: vi.fn(),
      });
      return (
        <div>
          <input aria-label="Search notes" />
          <button type="button">Done</button>
          {shouldShowPrompt && <div data-testid="prompt-open">Prompt</div>}
        </div>
      );
    }

    render(<Probe />);
    const input = screen.getByLabelText('Search notes');
    const doneBtn = screen.getByRole('button', { name: 'Done' });

    act(() => {
      input.focus();
      fireEvent.focusIn(input);
    });
    expect(screen.queryByTestId('prompt-open')).toBeNull();

    act(() => {
      fireEvent.focusOut(input, { relatedTarget: doneBtn });
      doneBtn.focus();
      vi.advanceTimersByTime(250);
    });
    expect(screen.getByTestId('prompt-open')).toBeInTheDocument();
  });

  it('DemoPage never shows InvitationModal for untouched starters, and reports the honest count once 3 notes are written', () => {
    const baseProps = {
      onSignUp: vi.fn(),
      onSignIn: vi.fn(),
      theme: 'light' as const,
      onThemeToggle: vi.fn(),
      onHomeClick: vi.fn(),
      onChangelogClick: vi.fn(),
      onRoadmapClick: vi.fn(),
      onPrivacyClick: vi.fn(),
      onTermsClick: vi.fn(),
      onSupportClick: vi.fn(),
    };

    // Untouched starters + 10 minutes elapsed: no prompt.
    seedDemoState((state) => {
      state.metadata.createdAt = TEN_MINUTES_AGO();
    });
    const first = render(<DemoPage {...baseProps} />);
    expect(screen.queryByRole('heading', { name: 'Keep your notes' })).toBeNull();
    first.unmount();

    // 3 created notes + 10 minutes elapsed, but Auth modal is open: no prompt behind Auth.
    createDemoNote({ title: 'A', content: '<p>A</p>', pinned: false, tagIds: [] });
    createDemoNote({ title: 'B', content: '<p>B</p>', pinned: false, tagIds: [] });
    createDemoNote({ title: 'C', content: '<p>C</p>', pinned: false, tagIds: [] });

    const { rerender } = render(<DemoPage {...baseProps} isAuthModalOpen />);
    expect(screen.queryByRole('heading', { name: 'Keep your notes' })).toBeNull();

    // Auth modal closes: prompt shows with the honest count (3, not 8).
    rerender(<DemoPage {...baseProps} isAuthModalOpen={false} />);
    expect(screen.getByText('Keep your notes')).toBeInTheDocument();
    expect(screen.getByText('3 notes')).toBeInTheDocument();
    expect(screen.queryByText('8 notes')).toBeNull();
  });
});
