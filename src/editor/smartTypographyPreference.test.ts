import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SMART_TYPOGRAPHY_CHANGE_EVENT,
  loadSmartTypographyPreference,
  setSmartTypographyPreference,
} from './smartTypographyPreference';

const source = (file: string) => readFileSync(path.join(__dirname, '..', file), 'utf8');

describe('smartTypographyPreference', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  // Settings imports this module. A Tiptap import here would make opening Settings
  // download the whole editor (scripts/check-bundle-budget.mjs checks the build too).
  it('imports nothing from Tiptap or ProseMirror', () => {
    expect(source('editor/smartTypographyPreference.ts')).not.toMatch(/from ['"](@tiptap|prosemirror)/);
  });

  it('is what Settings imports, not the Tiptap extension', () => {
    const settings = source('components/EditorSettings.tsx');
    expect(settings).not.toMatch(/editor\/SmartTypography['"]/);
    expect(settings).toMatch(/editor\/smartTypographyPreference['"]/);
  });

  it('defaults to on and reads a stored off', () => {
    expect(loadSmartTypographyPreference()).toBe(true);
    localStorage.setItem('yidhan:editor:smart-typography', 'false');
    expect(loadSmartTypographyPreference()).toBe(false);
  });

  it('stays on when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(loadSmartTypographyPreference()).toBe(true);
  });

  it('stores the choice and tells open editors', () => {
    const listener = vi.fn();
    window.addEventListener(SMART_TYPOGRAPHY_CHANGE_EVENT, listener);
    setSmartTypographyPreference(false);
    window.removeEventListener(SMART_TYPOGRAPHY_CHANGE_EVENT, listener);
    expect(localStorage.getItem('yidhan:editor:smart-typography')).toBe('false');
    expect((listener.mock.calls[0][0] as CustomEvent<boolean>).detail).toBe(false);
  });

  it('still dispatches when storage throws on write', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    const listener = vi.fn();
    window.addEventListener(SMART_TYPOGRAPHY_CHANGE_EVENT, listener);
    setSmartTypographyPreference(true);
    window.removeEventListener(SMART_TYPOGRAPHY_CHANGE_EVENT, listener);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
