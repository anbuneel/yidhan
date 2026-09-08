import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DemoPage } from './DemoPage';
import { DEMO_SEARCH_INPUT_ID } from '../utils/searchFocus';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, signOut: vi.fn() }),
}));

function renderDemo() {
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
