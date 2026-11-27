import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// The landing FAQ said import, JSON exports and .yidhan backups were "From Settings".
// None of that is in Settings. These checks hold every public surface to what exists.
const root = resolve(__dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8').replace(/\s+/g, ' ');

const SURFACES = [
  'index.html',
  'src/components/LandingPage.tsx',
  'src/components/PrivacyPage.tsx',
  'src/components/SupportPage.tsx',
  'src/components/SecurityPage.tsx',
  'src/components/TermsPage.tsx',
];

describe('import and export claims', () => {
  it('the import picker cannot read .yidhan, which is why the copy says so', () => {
    const header = read('src/components/Header.tsx');
    const accept = /accept="([^"]+)"/.exec(header)?.[1];
    expect(accept).toBe('.json,.md,.markdown');
    expect(accept).not.toContain('yidhan');
  });

  it('the profile menu holds export and import, not Settings', () => {
    const header = read('src/components/Header.tsx');
    for (const label of ["label: 'Export (JSON)'", "label: 'Export (Markdown)'", "label: 'Import notes'"]) {
      expect(header).toContain(label);
    }
    const settings = read('src/components/SettingsModal.tsx');
    expect(settings).not.toMatch(/Export \(JSON\)|Import notes/);
  });

  it('the encrypted backup is offered in the account-deletion dialog', () => {
    expect(read('src/components/LettingGoModal.tsx')).toContain('createEncryptedBackup');
  });

  it.each(SURFACES)('%s does not place import or export in Settings', (path) => {
    const text = read(path);
    expect(text).not.toMatch(/from settings you can (import|export)/i);
    expect(text).not.toMatch(/open settings and use the export/i);
    expect(text).not.toMatch(/import [^.]{0,60}\.yidhan backup/i);
    expect(text).not.toMatch(/export [^.]{0,40}\(json, markdown, or an encrypted \.yidhan backup\)/i);
  });
});
