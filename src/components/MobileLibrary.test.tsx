import { act, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { TimeRibbon } from './TimeRibbon';
import { ChapterSection } from './ChapterSection';
import { createMockNote } from '../test/factories';
import { createDemoStarterPreviewState } from '../services/demoStorage';
const originalObserver = window.IntersectionObserver;
afterEach(() => { vi.restoreAllMocks(); window.IntersectionObserver = originalObserver; });
it('puts a caption under the first card without a modal', () => {
  render(<ChapterSection chapterKey="thisWeek" label="This Week" notes={[createMockNote()]} defaultExpanded showGestureHint onNoteClick={vi.fn()} onNoteDelete={vi.fn()} onTogglePin={vi.fn()} />);
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByText('Swipe right to pin a note.')).toBeVisible();
});
it('hides the ribbon for small libraries and when the footer approaches', () => {
  let notify: IntersectionObserverCallback = () => {};
  window.IntersectionObserver = class {
    constructor(callback: IntersectionObserverCallback) { notify = callback; }
    root = null; rootMargin = ''; thresholds = []; observe() {} unobserve() {} disconnect() {} takeRecords() { return []; }
  };
  const chapters = [{ key: 'pinned' as const, label: 'Pinned' }, { key: 'thisWeek' as const, label: 'Week' }];
  const view = (count: number) => <><footer>End of library</footer><TimeRibbon noteCount={count} chapters={chapters} currentChapter="thisWeek" onChapterClick={vi.fn()} /></>;
  const { rerender } = render(view(19));
  expect(screen.queryByRole('navigation')).toBeNull();
  rerender(view(20));
  expect(screen.getByRole('navigation')).toBeVisible();
  act(() => notify([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
  expect(screen.queryByRole('navigation')).toBeNull();
});
it('plainly labels fresh Practice Space drafts as unencrypted', () => {
  const welcome = createDemoStarterPreviewState().notes.find(n => n.localId === 'starter-welcome')!;
  expect(welcome.content).toContain('not encrypted');
  expect(welcome.content).toContain('Sign up');
});
