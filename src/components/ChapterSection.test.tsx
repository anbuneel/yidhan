import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createMockNote } from '../test/factories';
import type { ChapterKey } from '../utils/temporalGrouping';
import { ChapterSection } from './ChapterSection';

function renderChapter(chapterKey: ChapterKey) {
  render(
    <ChapterSection
      chapterKey={chapterKey}
      label={chapterKey}
      notes={[createMockNote()]}
      defaultExpanded
      isPinned={chapterKey === 'pinned'}
      onNoteClick={vi.fn()}
      onRetryLockedNote={vi.fn()}
      onNoteDelete={vi.fn()}
      onTogglePin={vi.fn()}
    />
  );

  const content = document.getElementById(`chapter-content-${chapterKey}`);
  if (!content) throw new Error(`${chapterKey} chapter content was not rendered`);
  return content;
}

describe('ChapterSection age fade', () => {
  it.each([
    ['earlier', '0.9'],
    ['archive', '0.9'],
    ['pinned', '1'],
  ] satisfies [ChapterKey, string][])('sets %s chapter opacity to %s', (chapterKey, opacity) => {
    expect(renderChapter(chapterKey).style.opacity).toBe(opacity);
  });
});
