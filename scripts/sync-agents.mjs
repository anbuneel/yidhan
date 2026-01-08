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

try {
  const claudeContent = await fs.readFile(claudePath, 'utf8');
  const agentsContent = await readFileIfExists(agentsPath);

  if (claudeContent === agentsContent) {
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
