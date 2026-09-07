import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const baselinePath = join(root, 'scripts', 'unused-exports-baseline.json');
const knipCli = join(root, 'node_modules', 'knip', 'bin', 'knip.js');
const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));

const run = spawnSync(process.execPath, [
  knipCli,
  '--include',
  'exports,nsExports,types,nsTypes',
  '--reporter',
  'json',
  '--no-exit-code',
], {
  cwd: root,
  encoding: 'utf8',
});

if (run.error) throw run.error;
if (run.status !== 0) {
  process.stderr.write(run.stderr);
  process.exit(run.status ?? 1);
}

const report = JSON.parse(run.stdout);
const issueKinds = ['exports', 'nsExports', 'types', 'nsTypes'];
const detected = report.issues.flatMap((fileIssue) =>
  issueKinds.flatMap((kind) =>
    (fileIssue[kind] ?? []).map((issue) => {
      const symbol = issue.namespace
        ? `${issue.namespace}.${issue.name}`
        : issue.name;
      return `${fileIssue.file.replaceAll('\\', '/')}|${kind}|${symbol}`;
    })
  )
).sort();
const audited = [...baseline.issues].sort();
const auditedSet = new Set(audited);
const detectedSet = new Set(detected);
const newIssues = detected.filter((issue) => !auditedSet.has(issue));
const staleBaseline = audited.filter((issue) => !detectedSet.has(issue));

if (newIssues.length > 0 || staleBaseline.length > 0) {
  if (newIssues.length > 0) {
    console.error('New unused exports (remove them or explicitly audit the baseline):');
    for (const issue of newIssues) console.error(`  ${issue}`);
  }
  if (staleBaseline.length > 0) {
    console.error('Resolved baseline entries (remove them from the audited baseline):');
    for (const issue of staleBaseline) console.error(`  ${issue}`);
  }
  process.exit(1);
}

console.log(`Unused-export audit passed (${detected.length} audited legacy symbols, 0 new).`);
