import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { changelog } from '../data/changelog';
import { roadmap } from '../data/roadmap';
import { publicPageForPath } from '../../scripts/public-page-documents.mjs';
import {
  PUBLIC_PAGE_NAMES,
  STATIC_PAGE_CLASS,
  escapeHtml,
  publicPageDocument,
  renderPublicPageBody,
  staticPageCss,
} from './publicPageDocument';

const repo = resolve(__dirname, '../..');
const indexHtml = readFileSync(resolve(repo, 'index.html'), 'utf8');

/** What React writes for a text node, so data can be looked for in rendered markup. */
const asText = (text: string) => renderToStaticMarkup(<>{text}</>);

const HEADINGS: Record<(typeof PUBLIC_PAGE_NAMES)[number], RegExp> = {
  changelog: /<h1[^>]*>What&#x27;s new<\/h1>/,
  roadmap: /<h1[^>]*>Roadmap<\/h1>/,
  privacy: /<h1[^>]*>Privacy<\/h1>/,
  terms: /<h1[^>]*>Terms[^<]*<\/h1>/,
  support: /<h1[^>]*>Support<\/h1>/,
  security: /<h1[^>]*>[^<]+<\/h1>/,
};

describe('public page documents', () => {
  it('covers exactly the six public pages', () => {
    expect([...PUBLIC_PAGE_NAMES].sort()).toEqual(['changelog', 'privacy', 'roadmap', 'security', 'support', 'terms']);
  });

  describe.each(PUBLIC_PAGE_NAMES)('/%s', (page) => {
    const html = publicPageDocument(indexHtml, page);

    it('puts the page where the landing shell was, and drops the shell', () => {
      expect(html).toMatch(HEADINGS[page]);
      expect(html).toContain(`<div id="root"><div class="${STATIC_PAGE_CLASS}">`);
      expect(html).not.toContain('boot-landing"');
      expect(html).not.toContain('A notes app built around writing.</h1>');
    });

    it('keeps the head, boot.js and the bundle, with its own title and canonical URL', () => {
      expect(html).toContain('<script src="/boot.js"></script>');
      expect(html).toContain('<script type="module" src="/src/main.tsx"></script>');
      expect(html.match(/<title>/g)).toHaveLength(1);
      expect(html).toMatch(/<title>[A-Z][a-z]+ · Yidhan<\/title>/);
      expect(html).toContain(`<link rel="canonical" href="https://yidhan.vercel.app/${page}" />`);
      expect(html).toContain(`<meta property="og:url" content="https://yidhan.vercel.app/${page}" />`);
    });

    it('links to the other pages with plain links, which work without JavaScript', () => {
      for (const other of ['privacy', 'terms', 'support']) {
        if (other !== page) expect(html).toContain(`<a href="/${other}"`);
      }
      if (page !== 'changelog') expect(html).toContain('<a href="/changelog"');
      if (page !== 'roadmap') expect(html).toContain('<a href="/roadmap"');
    });
  });

  it('turns the in-text links on /privacy and /terms into plain links too', () => {
    expect(renderPublicPageBody('privacy')).toMatch(/<a href="\/security"[^>]*>security page<\/a>/);
    expect(renderPublicPageBody('terms')).toMatch(/<a href="\/privacy"[^>]*>Privacy Policy<\/a>/);
  });

  it('renders every changelog entry from src/data/changelog.ts', () => {
    const body = renderPublicPageBody('changelog');
    for (const entry of changelog) {
      expect(body).toContain(entry.version);
      for (const change of entry.changes) expect(body).toContain(asText(change.text));
    }
  });

  it('renders every roadmap item from src/data/roadmap.ts', () => {
    const body = renderPublicPageBody('roadmap');
    for (const item of roadmap) {
      expect(body).toContain(asText(item.title));
      expect(body).toContain(asText(item.description));
    }
  });

  it('escapes data rather than writing it as markup', async () => {
    vi.resetModules();
    vi.doMock('../data/changelog', () => ({
      changelog: [{ version: '9.9.9', date: '2026-11-08', changes: [{ type: 'fix', text: '<script>alert(1)</script> & "quotes"' }] }],
    }));
    try {
      const fresh = await import('./publicPageDocument');
      const body = fresh.renderPublicPageBody('changelog');
      expect(body).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;quotes&quot;');
      expect(body).not.toContain('<script>');
    } finally {
      vi.doUnmock('../data/changelog');
      vi.resetModules();
    }
  });

  it('inserts the body literally, never expanding replacement patterns', () => {
    const html = publicPageDocument(indexHtml, 'privacy', '<p>$& $1 $$</p>');
    expect(html).toContain('<p>$& $1 $$</p>');
  });

  it('escapes text it writes into the head', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  });

  it('fails rather than guessing when the template has drifted', () => {
    expect(() => publicPageDocument(indexHtml.replace('<div id="root">', '<div id="app">'), 'privacy', '')).toThrow(/root/);
    expect(() => publicPageDocument(indexHtml.replace('</title>', '</title><title>x</title>'), 'privacy', '')).toThrow(/<title>/);
    expect(() => publicPageDocument(indexHtml.replace(/<link rel="canonical"[^>]*>/, ''), 'privacy', '')).toThrow(/canonical/);
    expect(() =>
      publicPageDocument(indexHtml.replace('</body>', '<div>after</div></body>'), 'privacy', '')
    ).toThrow(/end of <div id="root">/);
  });

  describe('static CSS', () => {
    const css = staticPageCss();

    it('hides the copy once boot.js has run, and the controls that need JavaScript', () => {
      expect(css).toContain(`html.boot-hidden .${STATIC_PAGE_CLASS} { display: none; }`);
      expect(css).toContain(`.${STATIC_PAGE_CLASS} header button { display: none; }`);
    });

    it('shows changelog and roadmap items that would otherwise wait for a scroll observer', () => {
      expect(css).toMatch(/\.changelog-item, [^{]*\.roadmap-item \{ opacity: inherit; transform: none; \}/);
    });

    it('repeats every dark theme token from index.css for an OS in dark mode', () => {
      const indexCss = readFileSync(resolve(repo, 'src/index.css'), 'utf8');
      const themeBlock = indexCss.slice(indexCss.indexOf('/* THEME-START'), indexCss.indexOf('/* THEME-END */'));
      const darkBlock = themeBlock.slice(themeBlock.indexOf('[data-theme="dark"] {'));
      const declarations = darkBlock.match(/--[\w-]+: [^;]+;/g) ?? [];
      expect(declarations.length).toBeGreaterThan(10);
      const media = css.slice(css.indexOf('@media (prefers-color-scheme: dark)'));
      expect(media).toContain(':root:not([data-theme]) {');
      for (const declaration of declarations) expect(media).toContain(declaration);
    });
  });
});

describe('which requests get a static document', () => {
  it('matches the six pages, with or without a trailing slash', () => {
    for (const page of PUBLIC_PAGE_NAMES) {
      expect(publicPageForPath(`/${page}`, PUBLIC_PAGE_NAMES)).toBe(page);
      expect(publicPageForPath(`/${page}/`, PUBLIC_PAGE_NAMES)).toBe(page);
    }
  });

  it('matches nothing else', () => {
    for (const path of ['/', '/demo', '/demo/new', '/s/abc', '/privacy/extra', '/nope', '/index', '/Privacy']) {
      expect(publicPageForPath(path, PUBLIC_PAGE_NAMES)).toBeNull();
    }
  });

  it('is served on Vercel by a rewrite ahead of the catch-all, for each page and no other', () => {
    const vercel = JSON.parse(readFileSync(resolve(repo, 'vercel.json'), 'utf8')) as {
      rewrites: { source: string; destination: string }[];
    };
    const catchAll = vercel.rewrites.findIndex((rewrite) => rewrite.source === '/(.*)');
    const htmlRewrites = vercel.rewrites.filter((rewrite) => rewrite.destination !== '/index.html');
    expect(htmlRewrites).toEqual(PUBLIC_PAGE_NAMES.map((page) => ({ source: `/${page}`, destination: `/${page}.html` })));
    for (const rewrite of htmlRewrites) expect(vercel.rewrites.indexOf(rewrite)).toBeLessThan(catchAll);
  });
});
