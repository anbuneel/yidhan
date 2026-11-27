#!/usr/bin/env node
/**
 * Compare two timing-harness runs: `node scripts/compare-perf.mjs before.json after.json`.
 * With one argument, compares it against perf-results/latest.json.
 *
 * Prints each metric's median before and after, the change, and the change as a
 * percentage. It judges nothing: at 4x throttling a 10% swing between two runs of
 * the same build is normal. See docs/setup/perf-harness.md.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const [beforePath, afterArg] = process.argv.slice(2);
if (!beforePath) {
  console.error('Usage: node scripts/compare-perf.mjs <before.json> [after.json]');
  process.exit(1);
}
const afterPath = afterArg ?? path.join('perf-results', 'latest.json');

const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
const before = read(beforePath);
const after = read(afterPath);

for (const [label, run] of [['before', before], ['after', after]]) {
  console.log(`${label}: ${run.commit} (${run.branch}${run.dirty ? ', dirty' : ''}) ${run.createdAt}, CPU ${run.cpuThrottle}x, ${run.samples} samples`);
}
if (before.cpuThrottle !== after.cpuThrottle || before.machine?.cpu !== after.machine?.cpu) {
  console.log('warning: the runs differ in throttle rate or CPU, so the numbers are not comparable');
}

const names = [...new Set([...Object.keys(before.metrics), ...Object.keys(after.metrics)])];
const width = Math.max(6, ...names.map((n) => n.length));
const cell = (m) => (m ? `${m.median}${m.unit === 'ms' ? ' ms' : ''}` : '—');

console.log(`\n${'metric'.padEnd(width)}  ${'before'.padStart(11)}  ${'after'.padStart(11)}  ${'change'.padStart(9)}  ${'%'.padStart(7)}`);
for (const name of names) {
  const b = before.metrics[name];
  const a = after.metrics[name];
  let change = '';
  let pct = '';
  if (a && b) {
    const delta = Math.round((a.median - b.median) * 10) / 10;
    change = `${delta > 0 ? '+' : ''}${delta}`;
    pct = b.median === 0 ? '' : `${delta > 0 ? '+' : ''}${Math.round((delta / b.median) * 100)}%`;
  }
  console.log(`${name.padEnd(width)}  ${cell(b).padStart(11)}  ${cell(a).padStart(11)}  ${change.padStart(9)}  ${pct.padStart(7)}`);
}
