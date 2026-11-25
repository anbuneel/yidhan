import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACCOUNT_OFFBOARDING_ENABLED } from '../config/featureFlags';
import { roadmap } from './roadmap';

const root = resolve(__dirname, '../..');
const read = (relPath: string) => readFileSync(resolve(root, relPath), 'utf8').replace(/\r\n/g, '\n');

function collectFiles(dir: string): string[] {
  return readdirSync(resolve(root, dir)).flatMap((name) => {
    const rel = join(dir, name).replace(/\\/g, '/');
    if (statSync(resolve(root, rel)).isDirectory()) return collectFiles(rel);
    return [rel];
  });
}

describe('Launch review track A — public copy and polish invariants', () => {
  describe('public roadmap (C4, C5, C6)', () => {
    it('does not list GitHub sign-in as unshipped', () => {
      const unshippedGitHub = roadmap.filter(
        (item) => item.status !== 'shipped' && /\bgithub\b/i.test(`${item.title} ${item.description}`)
      );
      expect(unshippedGitHub).toEqual([]);

      const oauthItem = roadmap.find((item) => /oauth/i.test(item.title));
      expect(oauthItem).toBeDefined();
      expect(oauthItem?.description).toMatch(/\bApple\b/);
    });

    it('frames writing stats as strictly on-device with nothing leaving the device', () => {
      expect(roadmap.find((item) => /usage analytics/i.test(item.title))).toBeUndefined();
      const statsItem = roadmap.find((item) => /writing stats/i.test(item.title));
      expect(statsItem).toBeDefined();
      expect(statsItem?.description).toMatch(/on your device/i);
      expect(statsItem?.description).toMatch(/nothing leaves/i);
    });

    it('drops testing coverage expansion, moves uncommitted items to exploring, and lists encrypted tag names', () => {
      expect(roadmap.find((item) => /testing coverage expansion/i.test(item.title))).toBeUndefined();

      const images = roadmap.find((item) => item.title === 'Image attachments');
      const virtual = roadmap.find((item) => item.title === 'Virtual scrolling');
      const encryptedTags = roadmap.find((item) => item.title === 'Encrypted tag names');

      expect(images?.status).toBe('exploring');
      expect(virtual?.status).toBe('exploring');
      expect(encryptedTags?.status).toBe('exploring');
      expect(roadmap.filter((item) => item.status === 'coming-soon')).toEqual([]);
    });
  });

  describe('scoped user-facing copy check (C1, C7)', () => {
    const EXCLUDED_FILES = new Set([
      'src/data/changelog.ts',
      'src/data/passphraseWords.ts',
      'src/pages/PlaygroundPage.tsx',
    ]);

    it('has zero stray hits for quiet space, Kintsugi, Midnight, or wabi in user-facing sources', () => {
      const candidates = [
        ...collectFiles('src').filter(
          (f) => !/\.test\.tsx?$/.test(f) && !/\.spec\.tsx?$/.test(f) && !EXCLUDED_FILES.has(f)
        ),
        'vite.config.ts',
        'index.html',
        'README.md',
      ];

      const offenders = candidates.filter((f) => /quiet space|Kintsugi|Midnight|wabi/i.test(read(f)));
      expect(offenders).toEqual([]);
    });

    it('uses AGPL-3.0 and drops stale tag-colour and starter-note claims in README.md', () => {
      const readme = read('README.md');
      expect(readme).not.toMatch(/\bMIT\b/);
      expect(readme).toMatch(/AGPL-3\.0/);
      expect(readme).not.toMatch(/## Tag Colors/);
      expect(readme).not.toMatch(/color picker/i);
      expect(readme).not.toMatch(/4 starter notes|Recipes tag/i);
    });

    it('uses plain wording in the PWA manifest description', () => {
      const viteConfig = read('vite.config.ts');
      expect(viteConfig).not.toMatch(/quiet space/i);
      expect(viteConfig).toMatch(/description:\s*'A notes app built around writing, encrypted on your device\.'/);
    });
  });

  describe('PRODUCT.md licence note (C8)', () => {
    it('does not retain the resolved licence open question', () => {
      const product = read('PRODUCT.md');
      expect(product).not.toMatch(/repo has no\s+`LICENSE` file/i);
    });
  });

  describe('obsolete welcome-note trigger verification (B5)', () => {
    it('checks that on_auth_user_created and public.create_welcome_note are absent without recreating them', () => {
      const sql = read('supabase/migrations/verify_migration_state.sql');
      expect(sql).toMatch(/NOT EXISTS[\s\S]*on_auth_user_created/);
      expect(sql).toMatch(/NOT EXISTS[\s\S]*create_welcome_note/);
      expect(sql).not.toMatch(/CREATE\s+(OR\s+REPLACE\s+)?(TRIGGER|FUNCTION)/i);
    });
  });

  describe('self-serve account deletion flag alignment (C2)', () => {
    it('keeps ACCOUNT_OFFBOARDING_ENABLED aligned with the Support and Privacy pages', () => {
      expect(ACCOUNT_OFFBOARDING_ENABLED).toBe(true);
    });
  });
});
