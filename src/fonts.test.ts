import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Fonts: one serif (Newsreader), Courier Prime for code, Literata for Cyrillic
// and Greek only (DECISIONS.md, 2026-11-09). Most cases here check where a face
// must not be: Literata on latin text, a removed family anywhere, faked caps.

const root = resolve(__dirname, '..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const fontsCss = read('src/fonts.css');

type Face = { family: string; style: string; weight: string; file: string; ranges: [number, number][] };

function parseRanges(value: string): [number, number][] {
  return value.split(',').map((part) => {
    const [lo, hi] = part.trim().replace(/^U\+/i, '').split('-');
    return [parseInt(lo, 16), parseInt(hi ?? lo, 16)];
  });
}

const faces: Face[] = [...fontsCss.matchAll(/@font-face\s*\{([^}]*)\}/g)].map(([, body]) => {
  const prop = (name: string) => body.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1].trim() ?? '';
  return {
    family: prop('font-family').replace(/['"]/g, ''),
    style: prop('font-style'),
    weight: prop('font-weight'),
    file: body.match(/url\('\.\/assets\/fonts\/([^']+)'\)/)?.[1] ?? '',
    ranges: parseRanges(prop('unicode-range')),
  };
});

const facesOf = (family: string) => faces.filter((face) => face.family === family);
const covers = (weight: string, lo: number, hi: number) => {
  const [min, max = min] = weight.split(/\s+/).map(Number);
  return min <= lo && max >= hi;
};
const overlaps = (ranges: [number, number][], lo: number, hi: number) =>
  ranges.some(([a, b]) => a <= hi && b >= lo);

/** Every file under a directory, skipping build output and dependencies. */
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return [path];
  });
}

describe('self-hosted fonts', () => {
  it('declares only the three families', () => {
    expect(new Set(faces.map((face) => face.family))).toEqual(
      new Set(['Newsreader', 'Literata', 'Courier Prime'])
    );
  });

  it('gives Newsreader a real roman and italic for 400 to 700 in every subset', () => {
    for (const style of ['normal', 'italic']) {
      const set = facesOf('Newsreader').filter((face) => face.style === style);
      expect(set.map((face) => face.file).sort()).toEqual(
        ['latin', 'latin-ext', 'vietnamese']
          .map((subset) => `newsreader-${style === 'normal' ? 'roman' : 'italic'}-${subset}.woff2`)
          .sort()
      );
      // 600 is what <strong> and the buttons ask for. A face that stops short of it
      // is how the old body face rendered a faked bold.
      for (const face of set) expect(covers(face.weight, 400, 700), face.file).toBe(true);
    }
  });

  it('gives Courier Prime a regular, an italic and a bold, and nothing variable', () => {
    const variants = new Set(facesOf('Courier Prime').map((face) => `${face.style} ${face.weight}`));
    expect(variants).toEqual(new Set(['normal 400', 'italic 400', 'normal 700']));
  });

  it('declares Literata only for Cyrillic and Greek, so latin text never fetches it', () => {
    const literata = facesOf('Literata');
    expect(literata).toHaveLength(8);
    for (const face of literata) {
      expect(face.file).toMatch(/^literata-(roman|italic)-(cyrillic|cyrillic-ext|greek|greek-ext)\.woff2$/);
      // Basic latin, latin-1, latin extended A and B, latin extended additional.
      expect(overlaps(face.ranges, 0x0000, 0x024f), face.file).toBe(false);
      expect(overlaps(face.ranges, 0x1e00, 0x1eff), face.file).toBe(false);
      expect(covers(face.weight, 400, 700), face.file).toBe(true);
    }
    // Newsreader must not claim those scripts either, or Literata would never be used.
    for (const face of facesOf('Newsreader')) {
      expect(overlaps(face.ranges, 0x0370, 0x03ff), face.file).toBe(false);
      expect(overlaps(face.ranges, 0x0400, 0x04ff), face.file).toBe(false);
    }
  });

  it('references only files that exist, and leaves no file unreferenced', () => {
    const onDisk = readdirSync(resolve(root, 'src/assets/fonts')).sort();
    expect(faces.map((face) => face.file).sort()).toEqual(onDisk);
  });

  it('ships a licence for every family and none for a removed one', () => {
    expect(readdirSync(resolve(root, 'public/licenses/fonts')).sort()).toEqual([
      'courier-prime-OFL.txt',
      'literata-OFL.txt',
      'newsreader-OFL.txt',
    ]);
    for (const file of readdirSync(resolve(root, 'public/licenses/fonts'))) {
      const text = read(`public/licenses/fonts/${file}`);
      expect(text).toMatch(/^Copyright /);
      expect(text).toMatch(/SIL OPEN FONT LICENSE Version 1\.1/);
    }
  });
});

describe('the font tokens', () => {
  const indexCss = read('src/index.css');
  const token = (name: string) => indexCss.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1].trim();

  it('puts every word in the serif stack, with Literata right after Newsreader', () => {
    expect(token('font-serif')).toMatch(/^'Newsreader', 'Literata', /);
    expect(token('font-display')).toBe('var(--font-serif)');
    expect(token('font-body')).toBe('var(--font-serif)');
  });

  it('sets the mono token in Courier Prime with the system monospace behind it', () => {
    expect(token('font-mono')).toMatch(/^'Courier Prime', ui-monospace, monospace$/);
  });

  it('sets the recovery key in the mono token, and the toolbar labels out of it', () => {
    const kit = read('src/components/RecoveryKeyKit.tsx');
    expect(kit).toMatch(/data-testid="recovery-key"[\s\S]{0,200}fontFamily: 'var\(--font-mono\)'/);
    expect(read('src/components/RecoveryKeyUnlockForm.tsx')).toContain(`fontFamily: 'var(--font-mono)'`);
    expect(read('src/components/RecoveryKeyKit.css')).toMatch(/recovery-kit-sheet-key \{[^}]*var\(--font-mono\)/);
    // Toolbar labels are Newsreader. On the landing a mono label also pulled
    // Courier Prime into the first visit.
    expect(read('src/editor/editorCommands.tsx')).not.toMatch(/textLabel\([^)]*font-mono/);
    expect(read('src/components/LandingPage.tsx')).not.toMatch(/\.landing-tb[^{]*\{[^}]*--font-mono/);
  });

  it('keeps the phone title out of the iOS zoom rule, and every input in it', () => {
    const rule = indexCss.match(/Prevent iOS zoom[\s\S]*?\{([\s\S]*?)\{\s*font-size:\s*16px !important;/)?.[1];
    expect(rule).toBeDefined();
    // The title is a textarea. 16px !important beat its 2.25rem inline size, so on a
    // phone the title was the same size as the note text.
    expect(rule).toMatch(/textarea:not\(\.editor-title\)/);
    expect(rule).not.toMatch(/(^|,)\s*textarea\s*,/);
    for (const type of ['text', 'email', 'password', 'search']) {
      expect(rule).toContain(`input[type="${type}"]`);
    }
    expect(read('src/components/Editor.tsx')).toMatch(/aria-label="Note title"[\s\S]{0,200}className="editor-title /);
  });
});

describe('removed faces stay removed', () => {
  const gone = /Cormorant|Source Sans|JetBrains/i;
  // Old release notes name the faces that shipped then. They are history, not use.
  const history = resolve(root, 'src/data/changelog.ts');

  it('names no removed family in src/, index.html or public/', () => {
    const files = [...walk(resolve(root, 'src')), ...walk(resolve(root, 'public')), resolve(root, 'index.html')]
      .filter((file) => file !== history && file !== __filename)
      .filter((file) => !/\.(woff2|png|webp|jpg|ico)$/.test(file));
    const hits = files.filter((file) => gone.test(readFileSync(file, 'utf8')));
    expect(hits).toEqual([]);
  });

  it('never fakes small capitals: Newsreader has none', () => {
    const files = walk(resolve(root, 'src')).filter((file) => /\.(css|tsx?|html)$/.test(file) && file !== __filename);
    const hits = files.filter((file) =>
      /font-variant-caps|font-variant:\s*small-caps|fontVariantCaps|\bsmall-caps\b/.test(readFileSync(file, 'utf8'))
    );
    expect(hits).toEqual([]);
  });
});

describe('the landing shell', () => {
  const html = read('index.html');
  const style = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';

  it('preloads and declares the latin Newsreader roman, exactly as fonts.css does', () => {
    const latin = facesOf('Newsreader').find((face) => face.style === 'normal' && face.file.endsWith('-latin.woff2'))!;
    const preloads = [...html.matchAll(/<link rel="preload" href="\/src\/assets\/fonts\/([^"]+)"/g)].map((m) => m[1]);
    expect(preloads).toEqual([latin.file]);

    const shellFaces = [...style.matchAll(/@font-face \{([^}]*)\}/g)].map(([, body]) => body);
    expect(shellFaces).toHaveLength(1);
    expect(shellFaces[0]).toContain(`font-family: 'Newsreader'`);
    expect(shellFaces[0]).toContain('font-style: normal');
    expect(shellFaces[0]).toContain(`font-weight: ${latin.weight}`);
    expect(shellFaces[0]).toContain(`/src/assets/fonts/${latin.file}`);
    expect(parseRanges(shellFaces[0].match(/unicode-range: ([^;]+);/)![1])).toEqual(latin.ranges);
  });

  it('names no family that fonts.css does not declare', () => {
    const declared = new Set(faces.map((face) => face.family));
    const fallbacks = new Set(['Georgia', 'serif']);
    const named = [...style.replace(/@font-face \{[^}]*\}/g, '').matchAll(/font-family:\s*([^;}]+)/g)]
      .flatMap(([, stack]) => stack.split(',').map((name) => name.trim().replace(/['"]/g, '')));
    expect(named.length).toBeGreaterThan(0);
    for (const name of named) expect(declared.has(name) || fallbacks.has(name), name).toBe(true);
  });
});

describe('the font build script', () => {
  it('exists, so the trimmed files can be rebuilt', () => {
    expect(existsSync(resolve(root, 'scripts/build-fonts.py'))).toBe(true);
  });
});
