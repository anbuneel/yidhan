import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// The public pages capped at 800px, about 100–120 characters a line. Body text now
// caps at about 65–72 characters. `ch` is the width of "0", and in Newsreader that is
// about 1.4 times the average letter: 68ch measured 97 characters a line at 1280px.
// 48ch holds about 68. The 5rem is the container's own side padding.
const PAGES = ['PrivacyPage', 'TermsPage', 'SupportPage', 'SecurityPage', 'ChangelogPage', 'RoadmapPage'];

describe.each(PAGES)('%s line length', (page) => {
  const source = readFileSync(resolve(__dirname, `${page}.tsx`), 'utf8');

  it('caps the content column at a ch measure that holds 65–72 Newsreader characters', () => {
    const match = /className="max-w-\[calc\((\d+)ch\+5rem\)\][^"]*px-6 sm:px-10[^"]*"\s+data-measure="public-page"/.exec(source);
    expect(match, 'measured content column').not.toBeNull();
    const ch = Number(match![1]);
    // 0.7ch is Newsreader's average character at body size, measured in the browser.
    expect(ch / 0.7).toBeGreaterThanOrEqual(65);
    expect(ch / 0.7).toBeLessThanOrEqual(72);
  });

  it('no longer uses the 800px cap', () => {
    expect(source).not.toContain('max-w-[800px]');
  });
});
