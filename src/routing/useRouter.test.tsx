import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from './useRouter';
import { SCROLL_REGION_ATTRIBUTE } from './scrollRegion';
import type { Route } from './routes';

/**
 * jsdom reports 0 for every layout measurement, so `applyScrollOffset` would decide
 * the region is too short to take any offset and never restore one. Give the region a
 * height the way a real browser would.
 */
function makeScrollable(element: HTMLElement, contentHeight: number, viewportHeight: number) {
  Object.defineProperty(element, 'scrollHeight', { value: contentHeight, configurable: true });
  Object.defineProperty(element, 'clientHeight', { value: viewportHeight, configurable: true });
}

function Harness({ allowPlayground = false }: { allowPlayground?: boolean }) {
  const { route, navigate, replaceRoute } = useRouter({ allowPlayground });

  return (
    <div>
      <span data-testid="route">{JSON.stringify(route)}</span>
      <button type="button" onClick={() => navigate({ name: 'note', noteId: 'note-1' })}>
        open note
      </button>
      <button type="button" onClick={() => navigate({ name: 'library' })}>
        go library
      </button>
      <button type="button" onClick={() => navigate({ name: 'faded' })}>
        go faded
      </button>
      <button type="button" onClick={() => replaceRoute({ name: 'library' })}>
        replace with library
      </button>
      <div data-testid="region" {...{ [SCROLL_REGION_ATTRIBUTE]: '' }} />
    </div>
  );
}

function currentRoute(): Route {
  return JSON.parse(screen.getByTestId('route').textContent ?? '{}') as Route;
}

/** Walk one entry back and let the router's popstate listener run. */
async function goBack() {
  await act(async () => {
    window.history.back();
    // jsdom queues popstate as a task; yield so it is delivered before we assert.
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('useRouter', () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState(null, '', '/');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads the opening route from the address bar', () => {
    window.history.replaceState(null, '', '/n/note-42');
    render(<Harness />);
    expect(currentRoute()).toEqual({ name: 'note', noteId: 'note-42' });
  });

  it('stamps the entry it opened on so a first navigation has somewhere to file from', () => {
    render(<Harness />);
    expect(window.history.state).toMatchObject({ yidhanHistoryKey: expect.any(Number) });
  });

  it('pushes an address when navigating', async () => {
    const user = userEvent.setup({ delay: null });
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'open note' }));

    expect(window.location.pathname).toBe('/n/note-1');
    expect(currentRoute()).toEqual({ name: 'note', noteId: 'note-1' });
  });

  it('does not push a second entry for the route already showing', async () => {
    const user = userEvent.setup({ delay: null });
    render(<Harness />);

    const pushSpy = vi.spyOn(window.history, 'pushState');
    await user.click(screen.getByRole('button', { name: 'go library' }));

    expect(pushSpy).not.toHaveBeenCalled();
  });

  it('replaces without adding an entry, so Back skips the corrected address', async () => {
    const user = userEvent.setup({ delay: null });
    window.history.replaceState(null, '', '/n/gone');
    render(<Harness />);

    const pushSpy = vi.spyOn(window.history, 'pushState');
    await user.click(screen.getByRole('button', { name: 'replace with library' }));

    expect(pushSpy).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe('/');
    expect(currentRoute()).toEqual({ name: 'library' });
  });

  it('follows Back to the previous address', async () => {
    const user = userEvent.setup({ delay: null });
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'open note' }));
    expect(currentRoute()).toEqual({ name: 'note', noteId: 'note-1' });

    await goBack();

    await waitFor(() => expect(currentRoute()).toEqual({ name: 'library' }));
    expect(window.location.pathname).toBe('/');
  });

  it('restores the library scroll position on Back from a note', async () => {
    const user = userEvent.setup({ delay: null });
    render(<Harness />);

    const region = screen.getByTestId('region');
    makeScrollable(region, 4000, 800);
    region.scrollTop = 1240;

    await user.click(screen.getByRole('button', { name: 'open note' }));
    // A forward navigation is a fresh visit: it starts at the top.
    expect(region.scrollTop).toBe(0);

    await goBack();

    await waitFor(() => expect(currentRoute()).toEqual({ name: 'library' }));
    await waitFor(() => expect(region.scrollTop).toBe(1240));
  });

  it('does not restore an offset onto a route the user navigated to afresh', async () => {
    const user = userEvent.setup({ delay: null });
    render(<Harness />);

    const region = screen.getByTestId('region');
    makeScrollable(region, 4000, 800);
    region.scrollTop = 900;

    await user.click(screen.getByRole('button', { name: 'open note' }));
    await user.click(screen.getByRole('button', { name: 'go library' }));

    // This is a new visit to the library, not a return to the one we left.
    expect(region.scrollTop).toBe(0);
  });

  it('keeps retrying while the list is still rendering', async () => {
    const user = userEvent.setup({ delay: null });
    render(<Harness />);

    const region = screen.getByTestId('region');
    makeScrollable(region, 4000, 800);
    region.scrollTop = 600;

    await user.click(screen.getByRole('button', { name: 'open note' }));

    // Come back to a region that has not laid out yet: the first attempt cannot take
    // the offset, so it must not settle for the clamped value.
    makeScrollable(region, 0, 0);
    await goBack();
    await waitFor(() => expect(currentRoute()).toEqual({ name: 'library' }));
    expect(region.scrollTop).toBe(0);

    makeScrollable(region, 4000, 800);
    await waitFor(() => expect(region.scrollTop).toBe(600), { timeout: 2000 });
  });

  it('remembers the faded view separately from the library', async () => {
    const user = userEvent.setup({ delay: null });
    render(<Harness />);

    const region = screen.getByTestId('region');
    makeScrollable(region, 4000, 800);

    region.scrollTop = 300;
    await user.click(screen.getByRole('button', { name: 'go faded' }));
    expect(currentRoute()).toEqual({ name: 'faded' });

    region.scrollTop = 1500;
    await user.click(screen.getByRole('button', { name: 'open note' }));

    await goBack();
    await waitFor(() => expect(currentRoute()).toEqual({ name: 'faded' }));
    await waitFor(() => expect(region.scrollTop).toBe(1500));

    await goBack();
    await waitFor(() => expect(currentRoute()).toEqual({ name: 'library' }));
    await waitFor(() => expect(region.scrollTop).toBe(300));
  });

  it('gates the playground on the dev flag', () => {
    window.history.replaceState(null, '', '/playground');
    const { unmount } = render(<Harness />);
    expect(currentRoute()).toEqual({ name: 'notFound', path: '/playground' });
    unmount();

    render(<Harness allowPlayground />);
    expect(currentRoute()).toEqual({ name: 'playground' });
  });

  it('keeps an unknown address in the bar instead of rewriting it', () => {
    window.history.replaceState(null, '', '/definitely-not-a-route');
    render(<Harness />);

    expect(currentRoute()).toEqual({ name: 'notFound', path: '/definitely-not-a-route' });
    expect(window.location.pathname).toBe('/definitely-not-a-route');
  });
});
