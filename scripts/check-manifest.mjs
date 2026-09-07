import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const manifest = JSON.parse(readFileSync(new URL('../dist/manifest.webmanifest', import.meta.url), 'utf8'));
assert.equal(Object.hasOwn(manifest, 'share_target'), false, 'The manifest must not send shared text in a GET request');
console.log('Manifest privacy assertion passed');
