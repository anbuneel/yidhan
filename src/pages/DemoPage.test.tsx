import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DemoPage } from './DemoPage';
import { DEMO_SEARCH_INPUT_ID } from '../utils/searchFocus';
import { getDemoState, updateDemoNote, deleteDemoNote } from '../services/demoStorage';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, signOut: vi.fn() }),
}));

vi.mock('../utils/editorLoader', () => ({
  getLoadedEditorComponent: () => null,
  loadEditorComponent: () => Promise.resolve({
    default: ({ note }: { note: { id: string; title: string; content: string } }) => (
      <div data-testid="mock-demo-editor" data-note-id={note.id}>
        <h1>{note.title}</h1>
        <p>{note.content}</p>
      </div>
    ),
  }),
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

  it('opens the visitor’s edited starter without creating a second copy', async () => {
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

  it('stays on the library without creating a copy if the visitor deleted that starter', async () => {
    const initialCount = getDemoState().notes.length;
    deleteDemoNote('starter-tuesday');

    const onInitialNoteOpened = vi.fn();
    renderDemo({
      initialNoteId: 'starter-tuesday',
      onInitialNoteOpened,
    });

    await screen.findByTestId('library-view');
    expect(screen.queryByTestId('mock-demo-editor')).not.toBeInTheDocument();
    expect(getDemoState().notes).toHaveLength(initialCount - 1);
    expect(onInitialNoteOpened).toHaveBeenCalledTimes(1);
  });
});
