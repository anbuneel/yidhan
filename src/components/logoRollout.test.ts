/**
 * The leaf logo rollout, checked against the files it touches: the icons the manifest
 * and index.html name, the landing shell's copy of the logo, and what the enso left.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { inflateSync } from 'zlib';
import { MARIGOLD, SMALL_MARK, WORDMARK } from './logoPaths';
import { SPRITE_MARK_SMALL, SPRITE_WORDMARK } from './logoSprite';

const ROOT = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const indexHtml = read('index.html');
const viteConfig = read('vite.config.ts');
const indexCss = read('src/index.css');

/** Width and height from a PNG's IHDR chunk. */
function pngSize(file: string): [number, number] {
  const b = fs.readFileSync(file);
  expect(b.subarray(1, 4).toString('latin1')).toBe('PNG');
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

/** Decode a PNG to RGBA (8-bit, colour types 2, 3 and 6, no interlace). Enough for our exports. */
function decodePng(file: string) {
  const b = fs.readFileSync(file);
  let o = 8;
  let w = 0, h = 0, type = 0, depth = 0;
  let palette: Buffer | null = null;
  let trns: Buffer | null = null;
  const idat: Buffer[] = [];
  while (o < b.length) {
    const len = b.readUInt32BE(o);
    const kind = b.subarray(o + 4, o + 8).toString('latin1');
    const data = b.subarray(o + 8, o + 8 + len);
    if (kind === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; type = data[9];
      expect(data[12]).toBe(0);
    } else if (kind === 'PLTE') palette = data;
    else if (kind === 'tRNS') trns = data;
    else if (kind === 'IDAT') idat.push(data);
    o += 12 + len;
  }
  expect(depth).toBe(8);
  const bpp = type === 6 ? 4 : type === 2 ? 3 : 1;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * bpp;
  const px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const cur = raw[y * (stride + 1) + 1 + x];
      const a = x >= bpp ? px[y * stride + x - bpp] : 0;
      const up = y > 0 ? px[(y - 1) * stride + x] : 0;
      const ul = x >= bpp && y > 0 ? px[(y - 1) * stride + x - bpp] : 0;
      let v = cur;
      if (f === 1) v += a;
      else if (f === 2) v += up;
      else if (f === 3) v += (a + up) >> 1;
      else if (f === 4) {
        const p = a + up - ul;
        const pa = Math.abs(p - a), pb = Math.abs(p - up), pc = Math.abs(p - ul);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? up : ul;
      }
      px[y * stride + x] = v & 255;
    }
  }
  const rgba = (x: number, y: number): [number, number, number, number] => {
    const i = y * stride + x * bpp;
    if (type === 3) {
      const k = px[i];
      return [palette![k * 3], palette![k * 3 + 1], palette![k * 3 + 2], trns && k < trns.length ? trns[k] : 255];
    }
    return [px[i], px[i + 1], px[i + 2], type === 6 ? px[i + 3] : 255];
  };
  return { w, h, rgba };
}

/** Every file under a folder, skipping binaries. */
function textFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...textFiles(rel));
    else if (/\.(ts|tsx|js|mjs|css|html|json|svg|txt|xml|webmanifest)$/.test(e.name)) out.push(rel);
  }
  return out;
}

describe('no leftovers from the enso mark', () => {
  // The changelog is release history: its 2026 entry about the enso stays true.
  const scanned = [...textFiles('src'), ...textFiles('public'), 'index.html'].filter(
    (f) => !f.replace(/\\/g, '/').endsWith('src/data/changelog.ts') && !f.endsWith('logoRollout.test.ts'),
  );

  it('"enso" appears nowhere in src/, public/ or index.html', () => {
    const hits = scanned.filter((f) => /\benso\b/i.test(read(f)));
    expect(hits).toEqual([]);
  });

  it('no file references a deleted mask, the mask script, or a moved enso image', () => {
    const gone = [
      'yidhan-logo-mark-arc',
      'yidhan-logo-mark-dot',
      'yidhan-logo-mark-512',
      'yidhan-logo-lockup-tight',
      'generate-logo-masks',
      'logo:masks',
      'brand-mark',
    ];
    const files = [...scanned, ...textFiles('scripts'), 'vite.config.ts', 'package.json'].filter(
      (f) => !f.endsWith('logoRollout.test.ts'),
    );
    const hits = files.flatMap((f) => gone.filter((g) => read(f).includes(g)).map((g) => `${f}: ${g}`));
    expect(hits).toEqual([]);
    expect(fs.existsSync(path.join(ROOT, 'src/assets/brand/yidhan-logo-mark-arc.webp'))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, 'scripts/generate-logo-masks.ts'))).toBe(false);
  });
});

describe('icons named by the manifest and index.html', () => {
  const linked = [...indexHtml.matchAll(/<link rel="(icon|apple-touch-icon)"[^>]*>/g)].map((m) => {
    const tag = m[0];
    return { tag, href: /href="([^"]+)"/.exec(tag)![1], sizes: /sizes="([^"]+)"/.exec(tag)?.[1] };
  });
  const manifest = [...viteConfig.matchAll(/src: '([^']+)',\s*sizes: '([^']+)',\s*type: 'image\/png',(\s*purpose: '([^']+)')?/g)].map(
    (m) => ({ href: m[1], sizes: m[2], purpose: m[4] }),
  );

  it('finds the links and the manifest entries it is meant to check', () => {
    expect(linked.map((l) => l.href)).toEqual([
      '/icons/icon-16.png',
      '/favicon.png',
      '/icons/icon-48.png',
      '/icons/icon-192.png',
      '/icons/apple-touch-icon.png',
    ]);
    expect(manifest).toEqual([
      { href: '/icons/icon-192.png', sizes: '192x192', purpose: undefined },
      { href: '/icons/icon-512.png', sizes: '512x512', purpose: undefined },
      { href: '/icons/maskable-512.png', sizes: '512x512', purpose: 'maskable' },
    ]);
  });

  it('every icon exists at the stated size', () => {
    for (const { href, sizes } of [...linked, ...manifest]) {
      expect(sizes, href).toBeDefined();
      const file = path.join(ROOT, 'public', href);
      expect(fs.existsSync(file), href).toBe(true);
      const [w, h] = pngSize(file);
      expect(`${w}x${h}`, href).toBe(sizes);
    }
  });

  it('every icon the service worker precaches exists', () => {
    const list = /includeAssets: \[([\s\S]*?)\]/.exec(viteConfig)![1];
    for (const [, p] of list.matchAll(/'([^'*]+\.png)'/g)) {
      expect(fs.existsSync(path.join(ROOT, 'public', p)), p).toBe(true);
    }
  });

  it('the maskable icon keeps the mark inside the safe zone', () => {
    // The safe zone is the centred circle of radius 40% of the icon. Outside it, a
    // launcher may crop, so every pixel there must be the plain tile colour.
    const { w, h, rgba } = decodePng(path.join(ROOT, 'public/icons/maskable-512.png'));
    const tile = rgba(0, 0);
    expect(tile[3]).toBe(255); // full bleed: no transparent corners
    const r = 0.4 * w;
    let outside = 0;
    let markInside = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const c = rgba(x, y);
        const same = c.every((v, i) => Math.abs(v - tile[i]) <= 2);
        const d = Math.hypot(x + 0.5 - w / 2, y + 0.5 - h / 2);
        if (d > r && !same) outside++;
        if (d <= r && !same) markInside++;
      }
    }
    expect(outside).toBe(0);
    expect(markInside).toBeGreaterThan(w * h * 0.1); // the mark is really there
  });

  it('the icons at 192px and up carry the letter; the favicons are the small drawing', () => {
    // The letter is drawn in the dark tile colour inside the marigold sun, so a large
    // icon has tile-coloured pixels inside the sun; a plain one has none.
    const sunHasLetter = (file: string) => {
      const { w, rgba } = decodePng(path.join(ROOT, 'public', file));
      const tile = rgba(0, Math.floor(w / 2)); // left edge, mid-height: tile colour
      // Sun centre on the 120 grid: from scripts/brand/flatten.py tile placement.
      const k = w / 120;
      const cx = (41 * 0.74 + 120 / 2 - 62.125 * 0.74) * k;
      const cy = (37 * 0.74 + 120 / 2 - 64.125 * 0.74) * k;
      const rr = 19 * 0.74 * k * 0.6;
      let dark = 0;
      for (let y = Math.floor(cy - rr); y < cy + rr; y++) {
        for (let x = Math.floor(cx - rr); x < cx + rr; x++) {
          if (Math.hypot(x - cx, y - cy) > rr) continue;
          const c = rgba(x, y);
          if (c.slice(0, 3).every((v, i) => Math.abs(v - tile[i]) <= 24)) dark++;
        }
      }
      return dark > 0;
    };
    expect(sunHasLetter('icons/icon-192.png')).toBe(true);
    expect(sunHasLetter('icons/icon-512.png')).toBe(true);
    expect(sunHasLetter('icons/maskable-512.png')).toBe(true);
    expect(sunHasLetter('icons/apple-touch-icon.png')).toBe(false);
  });
});

describe('landing shell mirrors Logo.tsx', () => {
  const sprite = /<svg class="logo-sprite"[^>]*>([\s\S]*?)<\/svg>/.exec(indexHtml);
  const group = (id: string) => new RegExp(`<g id="${id}">([\\s\\S]*?)</g>`).exec(sprite?.[1] ?? '')?.[1] ?? '';
  const mark = /<svg class="boot-mark"[^>]*>([\s\S]*?)<\/svg>/.exec(indexHtml);
  const word = /<svg class="boot-word"[^>]*>([\s\S]*?)<\/svg>/.exec(indexHtml);
  const ds = (svg: string) => [...svg.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]);

  it('the sprite sits outside #root, so React replacing the shell keeps it', () => {
    expect(sprite).not.toBeNull();
    expect(indexHtml.indexOf('class="logo-sprite"')).toBeLessThan(indexHtml.indexOf('<div id="root">'));
    expect(sprite![0]).toContain('aria-hidden="true"');
  });

  it('the sprite holds the generated small mark and wordmark, with the sun on the i', () => {
    expect(ds(group(SPRITE_MARK_SMALL.slice(1)))).toEqual([SMALL_MARK.sun, SMALL_MARK.leaf]);
    expect(ds(group(SPRITE_WORDMARK.slice(1)))).toEqual([WORDMARK.y, WORDMARK.rest, WORDMARK.sun]);
  });

  it('the shell draws the same sprite entries, in the same boxes, as Logo.tsx', () => {
    expect(mark![0]).toContain(`viewBox="${SMALL_MARK.viewBox}"`);
    expect(mark![1]).toBe(`<use href="${SPRITE_MARK_SMALL}"/>`);
    expect(word![0]).toContain(`viewBox="${WORDMARK.viewBox}"`);
    expect(word![1]).toBe(`<use href="${SPRITE_WORDMARK}"/>`);
  });

  it('names the logo once, with the mark decorative, and carries no text wordmark', () => {
    expect(mark![0]).toContain('aria-hidden="true"');
    expect(word![0]).toContain('role="img"');
    expect(word![0]).toContain('aria-label="Yidhan"');
    const header = /<header class="boot-header">([\s\S]*?)<\/header>/.exec(indexHtml)![1];
    expect(header.replace(/<[^>]+>/g, '').trim()).toBe('');
  });

  it('colours: the two suns marigold, leaf token on the leaf and the y, ink on the rest', () => {
    const small = group('yidhan-mark-small');
    const wm = group('yidhan-wordmark');
    expect(small).toContain(`<path fill="${MARIGOLD}" d="${SMALL_MARK.sun}"/>`);
    expect(small).toContain(`<path class="logo-leaf" d="${SMALL_MARK.leaf}"/>`);
    expect(wm).toContain(`<path class="logo-leaf" d="${WORDMARK.y}"/>`);
    expect(wm).toContain(`<path class="logo-ink" d="${WORDMARK.rest}"/>`);
    expect(wm).toContain(`<path fill="${MARIGOLD}" d="${WORDMARK.sun}"/>`);
    // Marigold is the only colour written into the sprite.
    const fixed = [...sprite![1].matchAll(/fill="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(fixed)).toEqual(new Set([MARIGOLD]));
    // App tokens first; the shell's own values before the bundle's CSS arrives.
    expect(indexHtml).toContain('.logo-leaf { fill: var(--color-brand-leaf, var(--b-leaf)); }');
    expect(indexHtml).toContain('.logo-ink { fill: var(--color-text-primary, var(--b-text)); }');
  });

  it('the shell leaf colour matches the app token on each theme', () => {
    const appLight = /:root \{\s*--color-brand-leaf: (#[0-9A-Fa-f]{6});/.exec(indexCss)![1];
    const appDark = /\[data-theme="dark"\] \{\s*--color-brand-leaf: (#[0-9A-Fa-f]{6});/.exec(indexCss)![1];
    const shell = [...indexHtml.matchAll(/--b-leaf: (#[0-9A-Fa-f]{6})/g)].map((m) => m[1]);
    // Dark default, light media query, light data-theme.
    expect(shell).toEqual([appDark, appLight, appLight]);
  });

  it('sizes match the header lockup: 30px, and 36px from 640px, with a 0.3 gap', () => {
    const logo = read('src/components/Logo.tsx');
    expect(logo).toContain("const markClass = 'h-[30px] w-[30px] sm:h-[36px] sm:w-[36px]");
    expect(logo).toContain("const wordClass = 'h-[30px] sm:h-[36px] w-auto");
    expect(logo).toContain("const gapClass = 'gap-[9px] sm:gap-[10.8px]';");
    const [, , ww, wh] = WORDMARK.viewBox.split(' ');
    expect(indexHtml).toContain('.boot-logo { display: inline-flex; align-items: center; gap: 9px; }');
    expect(indexHtml).toContain('.boot-mark { width: 30px; height: 30px; flex-shrink: 0; }');
    expect(indexHtml).toContain(`.boot-word { height: 30px; width: auto; aspect-ratio: ${ww} / ${wh}; flex-shrink: 0; }`);
    expect(indexHtml).toContain(
      '@media (min-width: 640px) { .boot-logo { gap: 10.8px; } .boot-mark { width: 36px; height: 36px; } .boot-word { height: 36px; } }',
    );
  });
});
