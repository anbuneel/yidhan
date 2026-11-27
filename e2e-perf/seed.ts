/**
 * A fixed Practice Space for the timing harness.
 *
 * The same words every run, so two runs time the same work. Text comes from a
 * small word list and a seeded generator, not from anything real.
 */

export const LONG_NOTE_TITLE = 'Perf long note';
/** PERF_LONG_NOTE_WORDS changes it, for a run on a longer note (say 10000). */
export const LONG_NOTE_WORDS = Number(process.env.PERF_LONG_NOTE_WORDS ?? 2500);
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

/**
 * The long note: headings, bold, italic, links, bullet lists and task lists, so
 * serialising it walks many nodes and marks, as a real long note does. The word
 * count lands within a few words of the target. The last block is always a
 * paragraph, so typing lands in plain text.
 */
function richDocument(seed: number, wordCount: number): string {
  const next = generator(seed);
  const pick = () => WORDS[Math.floor(next() * WORDS.length)];
  let remaining = wordCount;

  /** `n` words with marks sprinkled in: about one word in six is bold, italic or a link. */
  const text = (n: number) => {
    const words: string[] = [];
    for (let i = 0; i < n; i++) {
      const word = pick();
      const roll = next();
      if (roll < 0.06) words.push(`<strong>${word}</strong>`);
      else if (roll < 0.12) words.push(`<em>${word}</em>`);
      else if (roll < 0.16) words.push(`<a href="https://example.com/${word}">${word}</a>`);
      else words.push(word);
    }
    remaining -= n;
    return words.join(' ');
  };
  const take = (min: number, spread: number) => Math.min(remaining, min + Math.floor(next() * spread));

  const blocks: string[] = [];
  let sinceHeading = 0;
  while (remaining > 0) {
    if (sinceHeading >= 6 && remaining > 20) {
      blocks.push(`<h2>${text(take(3, 4))}</h2>`);
      sinceHeading = 0;
      continue;
    }
    sinceHeading += 1;
    const roll = next();
    if (roll < 0.15 && remaining > 40) {
      const items: string[] = [];
      for (let i = 0, n = 3 + Math.floor(next() * 4); i < n && remaining > 0; i++) {
        items.push(`<li><p>${text(take(4, 10))}</p></li>`);
      }
      blocks.push(`<ul>${items.join('')}</ul>`);
    } else if (roll < 0.25 && remaining > 40) {
      const items: string[] = [];
      for (let i = 0, n = 3 + Math.floor(next() * 4); i < n && remaining > 0; i++) {
        const checked = next() < 0.4;
        items.push(
          `<li data-type="taskItem" data-checked="${checked}"><label><input type="checkbox"${checked ? ' checked' : ''}><span></span></label>` +
            `<div><p>${text(take(3, 8))}</p></div></li>`
        );
      }
      blocks.push(`<ul data-type="taskList">${items.join('')}</ul>`);
    } else {
      blocks.push(`<p>${text(take(30, 70))}.</p>`);
    }
  }
  if (!blocks[blocks.length - 1].startsWith('<p>')) blocks.push('<p>End.</p>');
  return blocks.join('');
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
    content: richDocument(7, LONG_NOTE_WORDS),
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
