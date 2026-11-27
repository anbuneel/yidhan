import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * One button shape (DECISIONS.md, 2026-11-26). Text buttons are 8px
 * (`--radius-button`). Icon-only buttons are circles, which needs `rounded-full` and a
 * fixed square `size-*`. There is no pill token. This fails if the drift comes back.
 *
 * A test, not a lint rule: the repo's ESLint setup has no JSX class-name rule to build
 * on, and "is this an icon-only button" needs the whole opening tag.
 */

const root = resolve(__dirname, '../..');
const BACKSLASH = String.fromCharCode(92);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

/** Every `<button …>` opening tag in a TSX source, braces and strings respected. */
function buttonOpeningTags(source: string): { tag: string; line: number }[] {
  const tags: { tag: string; line: number }[] = [];
  let i = 0;
  while ((i = source.indexOf('<button', i)) !== -1) {
    if (!/[\s>]/.test(source[i + 7] ?? '')) {
      i += 1;
      continue;
    }
    let j = i + 1;
    let depth = 0;
    let quote: string | null = null;
    for (; j < source.length; j++) {
      const c = source[j];
      if (quote) {
        if (c === quote && source[j - 1] !== BACKSLASH) quote = null;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') quote = c;
      else if (c === '{') depth += 1;
      else if (c === '}') depth -= 1;
      else if (c === '>' && depth === 0) break;
    }
    tags.push({ tag: source.slice(i, j + 1), line: source.slice(0, i).split('\n').length });
    i = j;
  }
  return tags;
}

const ICON_SIZED = /(^|[\s"'`])size-(\d|\[)/;
const BANNED_ON_TEXT = /(^|[\s"'`])(rounded-full|rounded-lg)(?=[\s"'`])/;

/** Offences in one source: text buttons with a pill or 12px corner. */
function buttonShapeOffences(source: string): string[] {
  return buttonOpeningTags(source)
    .filter(({ tag }) => !ICON_SIZED.test(tag) && BANNED_ON_TEXT.test(tag))
    .map(({ tag, line }) => `line ${line}: ${BANNED_ON_TEXT.exec(tag)![2]}`);
}

const tsxSources = walk(resolve(root, 'src')).filter((f) => f.endsWith('.tsx') && !/\.test\.tsx$/.test(f));

describe('button shape guard', () => {
  it('catches a pill or 12px text button, and lets an icon circle through', () => {
    expect(buttonShapeOffences('<button className="px-4 py-2 rounded-full">New note</button>')).toEqual(['line 1: rounded-full']);
    expect(buttonShapeOffences('<button\n  className={`px-4 ${a ? "x" : "y"} rounded-lg`}>Sign in</button>')).toEqual(['line 1: rounded-lg']);
    expect(buttonShapeOffences('<button className="size-9 rounded-full" aria-label="Toggle theme"><svg /></button>')).toEqual([]);
    expect(buttonShapeOffences('<button className="size-[44px] rounded-full" aria-label="x" />')).toEqual([]);
    expect(buttonShapeOffences('<button className="px-4 rounded-[var(--radius-button)]">Save</button>')).toEqual([]);
    // Other elements are not buttons; a span pill is not this rule's business.
    expect(buttonShapeOffences('<span className="rounded-full px-2">Saved</span>')).toEqual([]);
  });

  it('no text button in the app uses rounded-full or rounded-lg', () => {
    const offences = tsxSources.flatMap((file) =>
      buttonShapeOffences(readFileSync(file, 'utf8')).map((o) => `${relative(root, file)} ${o}`)
    );
    expect(offences).toEqual([]);
  });

  it('there is no --radius-pill anywhere the app is built from', () => {
    const files = [
      ...walk(resolve(root, 'src')).filter((f) => /\.(tsx?|css)$/.test(f) && !/\.test\.tsx?$/.test(f)),
      resolve(root, 'index.html'),
      ...walk(resolve(root, 'public')).filter((f) => /\.(js|css|html)$/.test(f)),
    ];
    expect(files.filter((f) => readFileSync(f, 'utf8').includes('--radius-pill')).map((f) => relative(root, f))).toEqual([]);
  });

  it('--radius-button is 8px, the same as inputs', () => {
    const css = readFileSync(resolve(root, 'src/index.css'), 'utf8');
    expect(css).toMatch(/--radius-button: 8px;/);
    expect(css).toMatch(/--radius-input: 8px;/);
    expect(css).toMatch(/--radius-plain: 12px;/);
  });

  it('the landing CTA and its index.html shell copy both use 8px', () => {
    const landing = readFileSync(resolve(root, 'src/components/LandingPage.tsx'), 'utf8');
    const html = readFileSync(resolve(root, 'index.html'), 'utf8');
    const rule = (src: string, selector: string) => src.slice(src.indexOf(`${selector} {`), src.indexOf('}', src.indexOf(`${selector} {`)));
    expect(rule(landing, '.landing-cta')).toContain('border-radius: var(--radius-button)');
    expect(rule(html, '.boot-cta')).toContain('border-radius: 8px');
  });
});
