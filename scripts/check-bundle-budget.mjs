// First-visit weight budgets (item 61). Runs after `vite build`, reads the built
// files in dist/, and fails the build when a budget in scripts/bundle-budget.json
// is exceeded. The budgets and their reasoning are in
// docs/plans/2026-11-07-first-visit-weight-proposal.md; the limits that are not yet
// at target are set to the last measurement, so they can only go down.
//
// What this measures, statically:
// - "before load" JS: classic scripts (boot.js), the entry module, its static
//   import closure, and every modulepreload in dist/index.html.
// - page total: that JS plus index.html, classic scripts, stylesheets and preloads
//   named in index.html. Images and fonts the page requests after mount are only
//   visible in a browser; e2e-sw/first-visit.spec.ts measures the full number.
// - precache: the URLs in dist/sw.js, text at gzip level 9, binaries as stored.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { KB, gzipBytes, readBudget, readEntry, readPrecacheUrls, transferBytes } from './bundle-budget-lib.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(repoRoot, 'dist');
const budget = readBudget(repoRoot);
const failures = [];
const rows = [];

const kb = (bytes) => Math.round((bytes / KB) * 10) / 10;

function check(name, measuredBytes, { limitKB, targetKB }) {
  const measured = kb(measuredBytes);
  const ok = measured <= limitKB;
  rows.push(`${ok ? 'ok  ' : 'FAIL'} ${name}: ${measured} KB (limit ${limitKB}, target ${targetKB})`);
  if (!ok) failures.push(`${name} is ${measured} KB, over its ${limitKB} KB limit`);
}

function requireThat(name, condition, message) {
  rows.push(`${condition ? 'ok  ' : 'FAIL'} ${name}`);
  if (!condition) failures.push(message);
}

const allJs = readdirSync(path.join(distDir, 'assets'))
  .filter((file) => file.endsWith('.js'))
  .map((file) => `assets/${file}`);
const read = (file) => readFileSync(path.join(distDir, file), 'utf8');

// A build without VITE_SENTRY_DSN folds `if (sentryDsn)` to false and drops Sentry,
// which takes about 78 KB gzip out of the entry path. Measuring that bundle would pass
// by accident. Production always sets a DSN, so CI must build with a dummy one.
const sentryBuiltIn = allJs.some((file) => read(file).includes('"BrowserTracing"'));
if (!sentryBuiltIn) {
  const message =
    'Sentry is not in this build, so the JS budgets would measure the wrong bundle. ' +
    'Build with a dummy VITE_SENTRY_DSN (CI does: see .github/workflows/ci.yml).';
  if (process.env.GITHUB_ACTIONS) {
    console.error(`Bundle budget: ${message}`);
    process.exit(1);
  }
  console.warn(`Bundle budget: skipping the JS budgets. ${message}`);
}

const entry = readEntry(distDir);
const closure = new Set(entry.closure);

if (sentryBuiltIn) {
  // boot.js is a classic script and runs before the bundle; the browser counts it too.
  const beforeLoadJs = [...entry.classicScripts, ...entry.closure].reduce(
    (sum, file) => sum + gzipBytes(distDir, file),
    0
  );
  check('landing JS before load (gzip)', beforeLoadJs, budget.landingJsBeforeLoad);

  const staticPage =
    beforeLoadJs +
    transferBytes(distDir, 'index.html') +
    [...entry.stylesheets, ...entry.preloads].reduce(
      (sum, file) => sum + (transferBytes(distDir, file) ?? 0),
      0
    );
  check('landing page total, static part (gzip)', staticPage, budget.landingPageTotal);

  // The unlocked library renders from the entry closure today: nothing it needs is
  // lazy. When step 5 splits the app shell out, add its chunks here.
  check('app-shell JS, Editor excluded (gzip)', beforeLoadJs, budget.appShellJs);

  const largest = allJs
    .map((file) => ({ file, bytes: gzipBytes(distDir, file) }))
    .sort((a, b) => b.bytes - a.bytes)[0];
  check(`largest JS chunk (gzip, ${largest.file})`, largest.bytes, budget.largestChunk);
}

// Step 3: the changelog data is read only by /changelog. Its longest entries are
// distinctive enough to survive minification; none may appear in the entry path.
const changelogSource = readFileSync(path.join(repoRoot, 'src', 'data', 'changelog.ts'), 'utf8');
const changelogMarkers = [...changelogSource.matchAll(/text: '((?:[^'\\]|\\.){60,})'/g)]
  .map((match) => match[1].replace(/\\'/g, "'"))
  .sort((a, b) => b.length - a.length)
  .slice(0, 3);
assert.ok(changelogMarkers.length === 3, 'Could not read markers from src/data/changelog.ts');
const changelogInEntry = entry.closure.filter((file) =>
  changelogMarkers.some((marker) => read(file).includes(marker))
);
requireThat(
  'changelog not in the entry closure',
  changelogInEntry.length === 0,
  `src/data/changelog.ts is in the entry path (${changelogInEntry.join(', ')}); load it with the Changelog page`
);

// Step 6, the build-time half: the registration code must not be in the entry path.
// e2e-sw/first-visit.spec.ts checks the runtime half (no worker request before load).
const registrationInEntry = entry.closure.filter((file) =>
  /virtual_pwa-register|workbox-window/.test(file)
);
requireThat(
  'service worker registration not in the entry closure',
  registrationInEntry.length === 0,
  `Service worker registration is loaded before load (${registrationInEntry.join(', ')})`
);

// Precache (step 1).
const precacheUrls = readPrecacheUrls(distDir);
const duplicates = [...new Set(precacheUrls.filter((url, index) => precacheUrls.indexOf(url) !== index))];
requireThat(
  `precache lists no URL twice (${precacheUrls.length} entries)`,
  duplicates.length <= budget.precacheDuplicateUrls.limit,
  `Precache lists these URLs more than once: ${duplicates.join(', ')}`
);

const missing = precacheUrls.filter((url) => transferBytes(distDir, url) === null);
assert.equal(missing.length, 0, `Precache lists files that are not in dist/: ${missing.join(', ')}`);

const precacheTotal = [...new Set(precacheUrls)].reduce((sum, url) => sum + transferBytes(distDir, url), 0);
check('precache transfer', precacheTotal, budget.precache);

const forbidden = precacheUrls.filter((url) => budget.precache.forbidden.some((pattern) => new RegExp(pattern).test(url)));
requireThat(
  'precache holds no splash screens or share image',
  forbidden.length === 0,
  `Precache holds files no offline visit reads: ${forbidden.join(', ')}`
);

const heavyPng = precacheUrls.filter(
  (url) => url.endsWith('.png') && transferBytes(distDir, url) > budget.precache.maxPngKB * KB
);
requireThat(
  `precache holds no PNG over ${budget.precache.maxPngKB} KB`,
  heavyPng.length === 0,
  `Precache holds PNGs over ${budget.precache.maxPngKB} KB: ${heavyPng.join(', ')}`
);

const kept = budget.precache.required.filter(
  (pattern) => !precacheUrls.some((url) => new RegExp(pattern).test(url))
);
requireThat(
  'precache keeps the shell icons and font licences',
  kept.length === 0,
  `Precache dropped files the offline shell needs: ${kept.join(', ')}`
);

console.log(rows.join('\n'));
if (failures.length) {
  const report = `Bundle budget failed:\n- ${failures.join('\n- ')}\nBudgets: scripts/bundle-budget.json. Reasoning: docs/plans/2026-11-07-first-visit-weight-proposal.md`;
  // CI is the gate, not the deploy. Vercel inlines the production Supabase key, which is
  // incompressible, so its build measures a few hundred bytes more than CI's placeholder
  // build; with limits ratcheted to within 1 KB of the last measurement that difference
  // alone failed every preview deploy. Vercel reports and deploys; GitHub Actions fails.
  if (process.env.VERCEL) {
    console.warn(`\n${report}\nNot enforced on Vercel: the GitHub Actions build is the gate.`);
  } else {
    console.error(`\n${report}`);
    process.exit(1);
  }
} else {
  console.log('Bundle budget assertions passed');
}
