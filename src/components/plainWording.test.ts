import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Design critique PR 2 "done when": these phrases are gone from user-facing copy.
// Comments are stripped first, so a code comment may still name the old wording.

const root = resolve(__dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8').replace(/\r\n/g, '\n');

function sourceFiles(dir: string): string[] {
  return readdirSync(resolve(root, dir)).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(resolve(root, path)).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // A line comment: "//" not preceded by ":" (URLs) or a quote.
    .replace(new RegExp(String.raw`(^|[^:'"])//.*$`, 'gm'), '$1');
}

// The changelog quotes old release notes; it is history, not current copy.
const sources = sourceFiles('src')
  .filter((f) => !f.replace(/\\/g, '/').endsWith('src/data/changelog.ts'))
  .map((f) => ({ file: f, text: withoutComments(read(f)) }));

const BANNED: [string, RegExp][] = [
  ['Release (as a verb or label)', /\bRelease\b(?!d)/],
  ['gentle goodbye', /gentle goodbye/i],
  ['quiet moments', /quiet moments/i],
  ['Two paths', /Two paths/],
  ['Keep my thoughts', /Keep my thoughts/],
  ['Keep them', /['">\s]Keep them['"<\s]/],
];

describe('plain wording (design critique PR 2)', () => {
  it.each(BANNED)('no user-facing string says "%s"', (_label, pattern) => {
    const hits = sources.filter(({ text }) => pattern.test(text)).map(({ file }) => file);
    expect(hits).toEqual([]);
  });

  it('keeps "Faded notes" and "Letting go" as names', () => {
    const all = sources.map(({ text }) => text).join('\n');
    expect(all).toContain('Faded notes');
    expect(all).toMatch(/Let(ting)? go/);
  });

  it('keeps the released-draft banner copy', () => {
    expect(read('src/components/Editor.tsx')).toContain('This note was released on another device.');
  });
});

describe('small polish (design critique K3, K6)', () => {
  it('sets sync captions at 12px, not 11px', () => {
    const indicator = read('src/components/SyncIndicator.tsx');
    expect(indicator).not.toContain('text-[11px]');
  });

  it('wraps landing section bodies with text-wrap: pretty', () => {
    const css = read('src/index.css');
    expect(css).toMatch(/\.landing-section-body \{[^}]*text-wrap: pretty;/);
  });
});
