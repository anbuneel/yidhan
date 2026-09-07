import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// A GET share_target puts the shared text in the URL, where it reaches server
// logs and history. The in-app paste path replaces it until #47 ships a POST
// handler; this guard keeps it from returning by accident.
const manifest = JSON.parse(readFileSync(new URL('../dist/manifest.webmanifest', import.meta.url), 'utf8'));
assert.equal(Object.hasOwn(manifest, 'share_target'), false, 'The manifest must not send shared text in a GET request');
console.log('Manifest privacy assertion passed');
