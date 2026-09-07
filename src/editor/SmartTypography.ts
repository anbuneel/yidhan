import { Extension, InputRule } from '@tiptap/core';

const SMART_TYPOGRAPHY_STORAGE_KEY = 'yidhan:editor:smart-typography';

export interface SmartTypographyStorage {
  enabled: boolean;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    smartTypography: {
      setSmartTypography: (enabled: boolean) => ReturnType;
      toggleSmartTypography: () => ReturnType;
    };
  }

  interface Storage {
    smartTypography: SmartTypographyStorage;
  }
}

export function loadSmartTypographyPreference(): boolean {
  try {
    return localStorage.getItem(SMART_TYPOGRAPHY_STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

function persistSmartTypographyPreference(enabled: boolean): void {
  try {
    localStorage.setItem(SMART_TYPOGRAPHY_STORAGE_KEY, String(enabled));
  } catch {
    // The setting still applies for this editor session when storage is unavailable.
  }
}

type SmartReplacement = { match: RegExp; replace: string };

const replacements: SmartReplacement[] = [
  { match: /\.\.\.$/, replace: '…' },
  { match: /--$/, replace: '—' },
  { match: /(^|[\s([{])"$/, replace: '“' },
  { match: /"$/, replace: '”' },
  { match: /(^|[\s([{])'$/, replace: '‘' },
  { match: /'$/, replace: '’' },
];

export const SmartTypography = Extension.create<Record<string, never>, SmartTypographyStorage>({
  name: 'smartTypography',

  addStorage() {
    return { enabled: loadSmartTypographyPreference() };
  },

  addCommands() {
    return {
      setSmartTypography: (enabled: boolean) => ({ tr, dispatch }) => {
        this.storage.enabled = enabled;
        persistSmartTypographyPreference(enabled);
        if (dispatch) dispatch(tr.setMeta('smartTypographyChanged', enabled));
        return true;
      },
      toggleSmartTypography: () => ({ tr, dispatch }) => {
        const enabled = !this.storage.enabled;
        this.storage.enabled = enabled;
        persistSmartTypographyPreference(enabled);
        if (dispatch) dispatch(tr.setMeta('smartTypographyChanged', enabled));
        return true;
      },
    };
  },

  addInputRules() {
    // Tiptap's input-rules pipeline deliberately skips both nodes whose schema
    // declares `code` (code blocks) and adjacent marks that declare `code`
    // (inline code), before any rule below is evaluated.
    return replacements.map(({ match, replace }) => new InputRule({
      find: (text) => {
        if (!this.storage.enabled) return null;
        const result = match.exec(text);
        if (!result) return null;
        return {
          text: result[0],
          index: result.index,
          data: { prefix: result[1] ?? '' },
        };
      },
      handler: ({ state, range, match: result }) => {
        const prefix = (result.data?.prefix as string | undefined) ?? '';
        state.tr.insertText(`${prefix}${replace}`, range.from, range.to);
      },
    }));
  },
});
