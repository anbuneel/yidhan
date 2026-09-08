import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');

const claudePath = path.join(rootDir, 'CLAUDE.md');
const agentsPath = path.join(rootDir, 'AGENTS.md');

const args = new Set(process.argv.slice(2));
const checkOnly = args.has('--check');
const quiet = args.has('--quiet');

async function readFileIfExists(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return '';
    }
    throw error;
  }
}

// Compare on normalised newlines, not raw bytes. `CLAUDE.md` is a working-copy file and
// picks up CRLF under `core.autocrlf` on Windows, while `.githooks/pre-commit` writes
// `AGENTS.md` from the git blob, which is always LF. The two are then identical in content
// and different in bytes, so a raw comparison fails `--check` on a Windows checkout while
// passing in CI. Only the line endings may differ — every other byte must match.
function sameContent(a, b) {
  return a.replace(/\r\n/g, '\n') === b.replace(/\r\n/g, '\n');
}

try {
  const claudeContent = await fs.readFile(claudePath, 'utf8');
  const agentsContent = await readFileIfExists(agentsPath);

  if (sameContent(claudeContent, agentsContent)) {
    if (!quiet) {
      console.log('AGENTS.md already matches CLAUDE.md.');
    }
    process.exit(0);
  }

  if (checkOnly) {
    console.error('AGENTS.md is out of sync with CLAUDE.md.');
    process.exit(1);
  }

  await fs.writeFile(agentsPath, claudeContent, 'utf8');
  if (!quiet) {
    console.log('Synced AGENTS.md from CLAUDE.md.');
  }
} catch (error) {
  console.error('Failed to sync AGENTS.md:', error instanceof Error ? error.message : error);
  process.exit(1);
}
