/**
 * Static documents for the six public pages, for visitors with JavaScript off (item 60).
 *
 * `index.html` carries a static copy of the landing's first screen, which React replaces
 * on mount. This does the same for `/privacy`, `/terms`, `/support`, `/security`,
 * `/changelog` and `/roadmap`: the page component is rendered to plain markup at build
 * time and put where the landing shell sits in a copy of the built `index.html`. Same
 * head, same stylesheet, same boot.js, same bundle. Nothing is hydrated.
 *
 * With JavaScript on, boot.js adds `boot-hidden` off the home path, which hides the
 * static copy, and the app renders the page exactly as it did before this existed.
 * With JavaScript off, boot.js never runs, so the copy shows, in the OS theme.
 *
 * Runs only under Vite's SSR loader: from scripts/public-page-documents.mjs after
 * `vite build`, and from the same file's dev middleware. Nothing in the app imports it.
 * Keep Supabase, Dexie and the sync engine out of it, as out of the public shell.
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { ChangelogPage } from '../components/ChangelogPage';
import { PrivacyPage } from '../components/PrivacyPage';
import { RoadmapPage } from '../components/RoadmapPage';
import { SecurityPage } from '../components/SecurityPage';
import { SupportPage } from '../components/SupportPage';
import { TermsPage } from '../components/TermsPage';
// Footer.css is the only stylesheet these pages import themselves; the rest is in the
// main stylesheet index.html already links. The build puts it in its own chunk, which
// the static document cannot name, so it is inlined. A page that imports another
// stylesheet must add it here.
import footerCss from '../components/Footer.css?inline';
import { PUBLIC_PAGE_ROUTES, routeToDocumentTitle, type PublicPageName } from '../routing/routes';
import { ACTIVE_DARK_THEME, themeToCss } from '../themes';

export const PUBLIC_PAGE_NAMES: readonly PublicPageName[] = PUBLIC_PAGE_ROUTES;

const SITE_ORIGIN = 'https://yidhan.vercel.app';

/** Wraps the static copy, so boot.js's `boot-hidden` can hide it once the app will render. */
export const STATIC_PAGE_CLASS = 'static-page';

const noop = () => {};

/**
 * The page body as plain markup. No navigation handlers are passed, so the footer and
 * in-text links render as `<a href>` rather than buttons and still work without
 * JavaScript. The theme toggle and Sign in need JavaScript; staticPageCss hides them.
 */
export function renderPublicPageBody(page: PublicPageName): string {
  // `theme` only picks the toggle's icon, and the toggle is hidden.
  const shared = { theme: 'dark' as const, onThemeToggle: noop, onSignIn: noop };
  const element = (() => {
    switch (page) {
      case 'changelog':
        return <ChangelogPage {...shared} />;
      case 'roadmap':
        return <RoadmapPage {...shared} />;
      case 'privacy':
        return <PrivacyPage {...shared} />;
      case 'terms':
        return <TermsPage {...shared} />;
      case 'support':
        return <SupportPage {...shared} />;
      case 'security':
        return <SecurityPage {...shared} />;
    }
  })();
  return renderToStaticMarkup(element);
}

/**
 * CSS the static copy needs and the app does not.
 *
 * - Hidden once boot.js has run, which is only when the app will render the page.
 * - The header's theme toggle and Sign in do nothing without JavaScript.
 * - Changelog and roadmap items start transparent and fade in from an
 *   IntersectionObserver, which never runs here.
 * - The theme: index.css keys the dark tokens on `data-theme`, which only boot.js sets.
 *   Without it the OS preference is the only signal, so the dark tokens are repeated
 *   under `prefers-color-scheme: dark` for a root with no `data-theme`.
 */
export function staticPageCss(): string {
  return [
    `html.boot-hidden .${STATIC_PAGE_CLASS} { display: none; }`,
    `.${STATIC_PAGE_CLASS} header button { display: none; }`,
    `.${STATIC_PAGE_CLASS} .changelog-item, .${STATIC_PAGE_CLASS} .roadmap-item { opacity: inherit; transform: none; }`,
    `@media (prefers-color-scheme: dark) {\n  :root:not([data-theme]) {\n${themeToCss(ACTIVE_DARK_THEME.colors, '    ')}\n  }\n}`,
    footerCss,
  ].join('\n');
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Replaces the one match of `pattern`, or throws: a template that drifted must fail the build. */
function replaceOnce(html: string, pattern: RegExp, replacement: string, what: string): string {
  const matches = html.match(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`));
  if (!matches || matches.length !== 1) {
    throw new Error(`publicPageDocument: expected one ${what} in the template, found ${matches?.length ?? 0}`);
  }
  // A function, so `$&` and friends in the replacement are never expanded.
  return html.replace(pattern, () => replacement);
}

/**
 * The static document for one page, from the `index.html` template (the built file in
 * production, the transformed source in dev).
 *
 * The landing shell is everything inside `<div id="root">`, found by counting `<div>`
 * tags to its matching close. Only scripts may follow the root.
 */
export function publicPageDocument(template: string, page: PublicPageName, body = renderPublicPageBody(page)): string {
  const url = `${SITE_ORIGIN}/${page}`;
  let html = template;
  html = replaceOnce(html, /<title>[^<]*<\/title>/, `<title>${escapeHtml(routeToDocumentTitle({ name: page }))}</title>`, '<title>');
  html = replaceOnce(html, /<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${escapeHtml(url)}" />`, 'canonical link');
  html = replaceOnce(html, /<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${escapeHtml(url)}" />`, 'og:url');
  html = replaceOnce(html, /<\/head>/, `<style>\n${staticPageCss()}\n</style>\n</head>`, '</head>');

  const rootOpen = '<div id="root">';
  const start = html.indexOf(rootOpen);
  if (start === -1 || html.indexOf(rootOpen, start + 1) !== -1) {
    throw new Error('publicPageDocument: expected one <div id="root"> in the template');
  }
  const contentStart = start + rootOpen.length;
  const tags = /<div[\s>]|<\/div>/g;
  tags.lastIndex = contentStart;
  let depth = 1;
  let rootClose = -1;
  for (let tag = tags.exec(html); tag; tag = tags.exec(html)) {
    depth += tag[0] === '</div>' ? -1 : 1;
    if (depth === 0) {
      rootClose = tag.index;
      break;
    }
  }
  const after = rootClose === -1 ? '' : html.slice(rootClose + '</div>'.length);
  if (rootClose === -1 || !/^(\s|<script\b[^>]*>\s*<\/script>)*<\/body>/.test(after)) {
    throw new Error('publicPageDocument: could not find the end of <div id="root"> in the template');
  }
  return `${html.slice(0, contentStart)}<div class="${STATIC_PAGE_CLASS}">${body}</div>${html.slice(rootClose)}`;
}
