import { StrictMode } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DemoPage } from './DemoPage';
import { DEMO_SEARCH_INPUT_ID } from '../utils/searchFocus';
import {
  DEMO_STORAGE_KEY,
  getDemoState,
  updateDemoNote,
  deleteDemoNote,
} from '../services/demoStorage';

const editorLoaderControl = vi.hoisted(() => ({
  pendingPromise: null as Promise<void> | null,
}));

const MockEditor = vi.hoisted(() => {
  return ({ note }: { note: { id: string; title: string; content: string } }) => (
    <div data-testid="mock-demo-editor" data-note-id={note.id}>
      <h1>{note.title}</h1>
      <p>{note.content}</p>
    </div>
  );
});

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, signOut: vi.fn() }),
}));

vi.mock('../utils/editorLoader', () => ({
  getLoadedEditorComponent: () => null,
  loadEditorComponent: async () => {
    if (editorLoaderControl.pendingPromise) {
      await editorLoaderControl.pendingPromise;
    }
    return { default: MockEditor };
  },
}));

function renderDemo(overrides: Partial<React.ComponentProps<typeof DemoPage>> = {}) {
  return render(
    <DemoPage
      onSignUp={vi.fn()}
      onSignIn={vi.fn()}
      theme="light"
      onThemeToggle={vi.fn()}
      onHomeClick={vi.fn()}
      onChangelogClick={vi.fn()}
      onRoadmapClick={vi.fn()}
      onPrivacyClick={vi.fn()}
      onTermsClick={vi.fn()}
      onSupportClick={vi.fn()}
      {...overrides}
    />
  );
}

describe('DemoPage keyboard shortcuts', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('focuses search on Cmd+K again after leaving and returning to the Practice Space', async () => {
    const user = userEvent.setup();

    const first = renderDemo();
    await screen.findByTestId('library-view');

    await user.keyboard('{Meta>}k{/Meta}');
    await waitFor(() =>
      expect(document.activeElement?.id).toBe(DEMO_SEARCH_INPUT_ID)
    );

    // Leaving /demo unmounts DemoPage, resetting its searchFocusToken state. The
    // module-scoped handled-token does not reset, so routing the shortcut through
    // the token left it dead on the second visit.
    first.unmount();

    renderDemo();
    await screen.findByTestId('library-view');

    await user.keyboard('{Meta>}k{/Meta}');
    await waitFor(() =>
      expect(document.activeElement?.id).toBe(DEMO_SEARCH_INPUT_ID)
    );
  });

  it('leaves cards alone while a dialog is open', async () => {
    const user = userEvent.setup();

    renderDemo();
    await screen.findByTestId('library-view');

    const cards = await screen.findAllByLabelText(/^Note: /);
    const firstCardLabel = cards[0].getAttribute('aria-label');
    expect(firstCardLabel).toBeTruthy();

    await user.keyboard('j');
    await user.keyboard('?');
    await screen.findByRole('dialog');

    // Delete fades a note, so it must not reach a card from behind a dialog. The
    // roving-focus target check covers the dialogs that take focus on open; the
    // `enabled` flag covers any that do not.
    await user.keyboard('{Delete}');

    expect(screen.getByLabelText(firstCardLabel as string)).toBeInTheDocument();
  });
});

describe('DemoPage initialNoteId (sample links)', () => {
  beforeEach(() => {
    localStorage.clear();
    editorLoaderControl.pendingPromise = null;
  });

  it('opens the requested sample note directly in the editor and consumes the arrival intent', async () => {
    const onInitialNoteOpened = vi.fn();

    renderDemo({
      initialNoteId: 'starter-revision',
      onInitialNoteOpened,
    });

    const editor = await screen.findByTestId('mock-demo-editor');
    expect(editor).toHaveAttribute('data-note-id', 'starter-revision');
    expect(editor).toHaveTextContent('Revision notes');
    expect(onInitialNoteOpened).toHaveBeenCalledTimes(1);
  });

  it('opens the visitor’s edited starter without overwriting or creating a second copy', async () => {
    const initialCount = getDemoState().notes.length;
    updateDemoNote('starter-used-books', {
      title: 'My bookshop notes',
      content: '<p>Edited by the visitor.</p>',
    });

    const onInitialNoteOpened = vi.fn();
    renderDemo({
      initialNoteId: 'starter-used-books',
      onInitialNoteOpened,
    });

    const editor = await screen.findByTestId('mock-demo-editor');
    expect(editor).toHaveAttribute('data-note-id', 'starter-used-books');
    expect(editor).toHaveTextContent('My bookshop notes');
    expect(editor).toHaveTextContent('Edited by the visitor.');

    const afterState = getDemoState();
    expect(afterState.notes).toHaveLength(initialCount);
    expect(afterState.notes.filter((n) => n.localId === 'starter-used-books')).toHaveLength(1);
    expect(onInitialNoteOpened).toHaveBeenCalledTimes(1);
  });

  it('adds and opens that one starter when the visitor previously deleted it', async () => {
    const initialCount = getDemoState().notes.length;
    deleteDemoNote('starter-tuesday');
    expect(getDemoState().notes).toHaveLength(initialCount - 1);

    const onInitialNoteOpened = vi.fn();
    renderDemo({
      initialNoteId: 'starter-tuesday',
      onInitialNoteOpened,
    });

    const editor = await screen.findByTestId('mock-demo-editor');
    expect(editor).toHaveAttribute('data-note-id', 'starter-tuesday');
    expect(editor).toHaveTextContent('Tuesday');

    const afterState = getDemoState();
    expect(afterState.notes).toHaveLength(initialCount);
    expect(afterState.notes.filter((n) => n.localId === 'starter-tuesday')).toHaveLength(1);
    expect(onInitialNoteOpened).toHaveBeenCalledTimes(1);
  });

  it('adds only the requested starter and preserves legacy work on pre-2026-11-10 storage', async () => {
    const now = Date.now();
    localStorage.setItem(
      DEMO_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        notes: [
          {
            localId: 'starter-books',
            title: 'My old edited book list',
            content: '<p>Kept from before November 2026.</p>',
            pinned: false,
            tagIds: [],
            createdAt: now - 10_000,
            updatedAt: now - 10_000,
          },
        ],
        tags: [],
        metadata: {
          createdAt: now - 10_000,
          lastVisit: now - 10_000,
          totalNotesCreated: 1,
          promptDismissedAt: null,
          ribbonDismissedAt: null,
        },
      })
    );

    const onInitialNoteOpened = vi.fn();
    renderDemo({
      initialNoteId: 'starter-used-books',
      onInitialNoteOpened,
    });

    const editor = await screen.findByTestId('mock-demo-editor');
    expect(editor).toHaveAttribute('data-note-id', 'starter-used-books');
    expect(editor).toHaveTextContent('Why I still buy used books');

    const afterState = getDemoState();
    expect(afterState.notes.map((n) => n.localId)).toEqual(['starter-used-books', 'starter-books']);
    expect(afterState.notes.find((n) => n.localId === 'starter-books')?.title).toBe(
      'My old edited book list'
    );
    expect(afterState.tags.some((t) => t.localId === 'tag-ideas')).toBe(true);
    expect(onInitialNoteOpened).toHaveBeenCalledTimes(1);
  });

  it('does not create a note or open the editor for an id that was never a starter', async () => {
    const initialCount = getDemoState().notes.length;
    const onInitialNoteOpened = vi.fn();

    renderDemo({
      initialNoteId: 'never-a-starter',
      onInitialNoteOpened,
    });

    await screen.findByTestId('library-view');
    expect(screen.queryByTestId('mock-demo-editor')).not.toBeInTheDocument();
    expect(getDemoState().notes).toHaveLength(initialCount);
    expect(onInitialNoteOpened).toHaveBeenCalledTimes(1);
  });

  it('ignores a late sample editor load when the visitor opened another note in the meantime', async () => {
    let releaseSampleLoad!: () => void;
    editorLoaderControl.pendingPromise = new Promise<void>((resolve) => {
      releaseSampleLoad = resolve;
    });

    const onInitialNoteOpened = vi.fn();
    renderDemo({
      initialNoteId: 'starter-revision',
      onInitialNoteOpened,
    });

    // While the editor chunk for `starter-revision` is still loading, click another note.
    await screen.findByTestId('library-view');
    const openWelcomeButton = screen.getByRole('button', { name: /^Open note: Welcome to Yidhan$/i });
    fireEvent.click(openWelcomeButton);

    // Finish loading the editor chunk; the visitor's newer click must win over the sample.
    await act(async () => {
      releaseSampleLoad();
      await Promise.resolve();
      await Promise.resolve();
    });

    const editor = await screen.findByTestId('mock-demo-editor');
    expect(editor).toHaveAttribute('data-note-id', 'starter-welcome');
    expect(editor).toHaveTextContent('Welcome to Yidhan');
  });
});

describe('DemoPage under StrictMode', () => {
  beforeEach(() => {
    localStorage.clear();
    editorLoaderControl.pendingPromise = null;
  });

  function renderDemoStrict(overrides: Partial<React.ComponentProps<typeof DemoPage>> = {}) {
    return render(
      <StrictMode>
        <DemoPage
          onSignUp={vi.fn()}
          onSignIn={vi.fn()}
          theme="light"
          onThemeToggle={vi.fn()}
          onHomeClick={vi.fn()}
          onChangelogClick={vi.fn()}
          onRoadmapClick={vi.fn()}
          onPrivacyClick={vi.fn()}
          onTermsClick={vi.fn()}
          onSupportClick={vi.fn()}
          {...overrides}
        />
      </StrictMode>
    );
  }

  it('reaches the editor for startWithNewNote under StrictMode', async () => {
    const onNewNoteStarted = vi.fn();
    renderDemoStrict({ startWithNewNote: true, onNewNoteStarted });

    const editor = await screen.findByTestId('mock-demo-editor');
    expect(editor).toBeInTheDocument();
    expect(onNewNoteStarted).toHaveBeenCalledTimes(1);
  });

  it('reaches the editor for initialNoteId under StrictMode', async () => {
    const onInitialNoteOpened = vi.fn();
    renderDemoStrict({ initialNoteId: 'starter-revision', onInitialNoteOpened });

    const editor = await screen.findByTestId('mock-demo-editor');
    expect(editor).toHaveAttribute('data-note-id', 'starter-revision');
    expect(editor).toHaveTextContent('Revision notes');
    expect(onInitialNoteOpened).toHaveBeenCalledTimes(1);
  });

  it('reaches the editor on a card click under StrictMode', async () => {
    renderDemoStrict();

    await screen.findByTestId('library-view');
    fireEvent.click(screen.getByRole('button', { name: /^Open note: Welcome to Yidhan$/i }));

    const editor = await screen.findByTestId('mock-demo-editor');
    expect(editor).toHaveAttribute('data-note-id', 'starter-welcome');
    expect(editor).toHaveTextContent('Welcome to Yidhan');
  });
});
