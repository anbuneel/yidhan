// Measurement helpers shared by scripts/check-bundle-budget.mjs and
// e2e-sw/first-visit.spec.ts, so the build check and the browser check count
// bytes the same way. Item 61; budgets live in scripts/bundle-budget.json.
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

/** Text files are counted at gzip level 9; images and fonts as stored. */
const TEXT_EXTENSIONS = new Set(['.js', '.mjs', '.css', '.html', '.txt', '.json', '.webmanifest', '.svg']);

export const KB = 1024;

export function isText(file) {
  return TEXT_EXTENSIONS.has(path.extname(file));
}

/** Bytes a visitor transfers for one built file: gzip for text, raw otherwise. */
export function transferBytes(distDir, relative) {
  const file = path.join(distDir, relative.replace(/^\/+/, ''));
  if (!existsSync(file) || !statSync(file).isFile()) return null;
  const buffer = readFileSync(file);
  return isText(file) ? gzipSync(buffer, { level: 9 }).length : buffer.length;
}

export function gzipBytes(distDir, relative) {
  const buffer = readFileSync(path.join(distDir, relative.replace(/^\/+/, '')));
  return gzipSync(buffer, { level: 9 }).length;
}

/** Static imports in a built chunk: `import … from "./x.js"`, `import "./x.js"`, `export … from`. Not `import()`. */
function staticImportsOf(source) {
  const found = new Set();
  const pattern = /\b(?:import|export)\s*(?:[\w$*{}\s,]*?\bfrom\s*)?["'](\.{1,2}\/[^"']+\.js)["']/g;
  for (const match of source.matchAll(pattern)) found.add(match[1]);
  return found;
}

/**
 * What `dist/index.html` makes the browser fetch before `load`: the entry module,
 * everything it imports statically, and every modulepreload. Paths are relative to dist.
 */
export function readEntry(distDir) {
  const html = readFileSync(path.join(distDir, 'index.html'), 'utf8');
  const attr = (tag, name) => tag.match(new RegExp(`\\b${name}="([^"]+)"`))?.[1];
  const tags = html.match(/<(?:script|link)\b[^>]*>/g) ?? [];

  const entries = [];
  const modulepreloads = [];
  const stylesheets = [];
  const preloads = [];
  const classicScripts = [];

  for (const tag of tags) {
    const rel = attr(tag, 'rel');
    if (tag.startsWith('<script')) {
      const src = attr(tag, 'src');
      if (!src) continue;
      (/type="module"/.test(tag) ? entries : classicScripts).push(src.replace(/^\//, ''));
    } else if (rel === 'modulepreload') {
      modulepreloads.push(attr(tag, 'href').replace(/^\//, ''));
    } else if (rel === 'stylesheet') {
      stylesheets.push(attr(tag, 'href').replace(/^\//, ''));
    } else if (rel === 'preload') {
      preloads.push(attr(tag, 'href').replace(/^\//, ''));
    }
  }

  const closure = new Set();
  const queue = [...entries, ...modulepreloads];
  while (queue.length) {
    const file = queue.shift();
    if (closure.has(file)) continue;
    closure.add(file);
    const source = readFileSync(path.join(distDir, file), 'utf8');
    for (const specifier of staticImportsOf(source)) {
      queue.push(path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier)));
    }
  }

  return { entries, modulepreloads, stylesheets, preloads, classicScripts, closure: [...closure] };
}

/** Every URL in the generated worker's precache manifest, in order, duplicates kept. */
export function readPrecacheUrls(distDir) {
  const worker = readFileSync(path.join(distDir, 'sw.js'), 'utf8');
  return [...worker.matchAll(/\{url:"([^"]+)",revision:/g)].map((match) => match[1]);
}

export function readBudget(repoRoot) {
  return JSON.parse(readFileSync(path.join(repoRoot, 'scripts', 'bundle-budget.json'), 'utf8'));
}
