/**
 * A fixed Practice Space for the timing harness.
 *
 * The same words every run, so two runs time the same work. Text comes from a
 * small word list and a seeded generator, not from anything real.
 */

export const LONG_NOTE_TITLE = 'Perf long note';
export const LONG_NOTE_WORDS = 2500;
const LIBRARY_NOTES = 40;

const WORDS = (
  'the a of and to in is it that was for on with as at by this from or be ' +
  'quiet window morning paper river letter garden table light winter road ' +
  'notice slowly moment kitchen thought return small evening green stone ' +
  'walk open close hold write read carry keep leave find turn wait listen'
).split(' ');

/** Park–Miller LCG. Deterministic and good enough to vary sentence shapes. */
function generator(seed: number) {
  let state = seed;
  return () => {
    state = (state * 48271) % 2147483647;
    return state / 2147483647;
  };
}

function paragraphs(seed: number, wordCount: number): string {
  const next = generator(seed);
  const out: string[] = [];
  let remaining = wordCount;
  while (remaining > 0) {
    const size = Math.min(remaining, 40 + Math.floor(next() * 80));
    const words: string[] = [];
    for (let i = 0; i < size; i++) {
      words.push(WORDS[Math.floor(next() * WORDS.length)]);
    }
    words[0] = words[0][0].toUpperCase() + words[0].slice(1);
    out.push(`<p>${words.join(' ')}.</p>`);
    remaining -= size;
  }
  return out.join('');
}

/** The `yidhan-demo-state` value: 40 short notes and one long one. */
export function seededDemoState(now: number) {
  const notes = [];
  for (let i = 0; i < LIBRARY_NOTES; i++) {
    notes.push({
      localId: `perf-note-${i}`,
      title: `Perf note ${String(i + 1).padStart(2, '0')}`,
      content: paragraphs(1000 + i, 50 + ((i * 37) % 250)),
      pinned: i < 2,
      tagIds: [],
      createdAt: now - (i + 1) * 60_000,
      updatedAt: now - (i + 1) * 60_000,
    });
  }
  // Newest, so its card is first in the recent chapter.
  notes.unshift({
    localId: 'perf-long-note',
    title: LONG_NOTE_TITLE,
    content: paragraphs(7, LONG_NOTE_WORDS),
    pinned: false,
    tagIds: [],
    createdAt: now,
    updatedAt: now,
  });

  return {
    version: 1,
    notes,
    tags: [],
    metadata: {
      createdAt: now,
      lastVisit: now,
      totalNotesCreated: notes.length,
      promptDismissedAt: now,
      ribbonDismissedAt: now,
    },
  };
}
