import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// The public pages capped at 800px, about 100–120 characters a line. Body text now
// caps at a 65–72ch measure; the 5rem is the container's own side padding.
const PAGES = ['PrivacyPage', 'TermsPage', 'SupportPage', 'SecurityPage', 'ChangelogPage', 'RoadmapPage'];

describe.each(PAGES)('%s line length', (page) => {
  const source = readFileSync(resolve(__dirname, `${page}.tsx`), 'utf8');

  it('caps the content column with a ch measure between 65 and 72', () => {
    const match = /className="max-w-\[calc\((\d+)ch\+5rem\)\][^"]*px-6 sm:px-10[^"]*"\s+data-measure="public-page"/.exec(source);
    expect(match, 'measured content column').not.toBeNull();
    const ch = Number(match![1]);
    expect(ch).toBeGreaterThanOrEqual(65);
    expect(ch).toBeLessThanOrEqual(72);
  });

  it('no longer uses the 800px cap', () => {
    expect(source).not.toContain('max-w-[800px]');
  });
});
