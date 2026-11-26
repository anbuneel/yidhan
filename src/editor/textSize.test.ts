import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8').replace(/\r\n/g, '\n');

/** Every rule whose body reads var(--reading-scale), by selector. */
function selectorsReadingScale(): string[] {
  const selectors: string[] = [];
  for (const match of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    if (match[2].includes('var(--reading-scale')) selectors.push(match[1].replace(/\/\*[\s\S]*?\*\//g, '').trim());
  }
  return selectors;
}

describe('text size CSS', () => {
  it('scales only the editor body and note card previews', () => {
    const selectors = selectorsReadingScale();
    expect(selectors.length).toBeGreaterThan(0);
    for (const selector of selectors) {
      for (const part of selector.split(',')) {
        // The landing shell, public pages and app chrome never read the scale.
        expect(part.trim()).toMatch(/^(\.rich-text-editor \.ProseMirror|\.note-card-preview)\b/);
      }
    }
  });

  it('resets the scale on shared notes, a public page', () => {
    expect(css).toMatch(/\.rich-text-editor \.ProseMirror\.shared-note-content \{[^}]*--reading-scale: 1;/);
  });

  it('defines exactly the small and large steps; default sets nothing', () => {
    expect(css).toMatch(/:root\[data-text-size="small"\] \{\s*--reading-scale: 0\.9;/);
    expect(css).toMatch(/:root\[data-text-size="large"\] \{\s*--reading-scale: 1\.15;/);
    expect(css).not.toMatch(/data-text-size="default"/);
  });
});
