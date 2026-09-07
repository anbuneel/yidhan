import { Extension } from '@tiptap/core';
import type { Editor } from '@tiptap/react';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state';

export interface FindMatch {
  from: number;
  to: number;
}

export interface FindReplaceState {
  query: string;
  matches: FindMatch[];
  activeIndex: number;
}

type FindReplaceAction =
  | { type: 'query'; query: string }
  | { type: 'move'; delta: 1 | -1 }
  | { type: 'activate'; index: number }
  | { type: 'clear' };

const findReplaceKey = new PluginKey<FindReplaceState>('findReplace');

function findMatches(state: EditorState, query: string): FindMatch[] {
  if (!query) return [];

  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matcher = new RegExp(escapedQuery, 'giu');

  const matches: FindMatch[] = [];
  state.doc.descendants((node, blockPosition) => {
    if (!node.isTextblock) return;

    const segments: Array<{ text: string; from: number; offset: number }> = [];
    let text = '';
    node.descendants((child, childPosition) => {
      if (!child.isText || !child.text) return;
      segments.push({ text: child.text, from: blockPosition + 1 + childPosition, offset: text.length });
      text += child.text;
    });

    const documentPosition = (offset: number, end: boolean): number | null => {
      const segment = segments.find((candidate) => {
        const segmentEnd = candidate.offset + candidate.text.length;
        return end
          ? offset > candidate.offset && offset <= segmentEnd
          : offset >= candidate.offset && offset < segmentEnd;
      });
      return segment ? segment.from + offset - segment.offset : null;
    };

    matcher.lastIndex = 0;
    for (let match = matcher.exec(text); match; match = matcher.exec(text)) {
      const from = documentPosition(match.index, false);
      const to = documentPosition(match.index + match[0].length, true);
      if (from !== null && to !== null) matches.push({ from, to });
      if (match[0].length === 0) matcher.lastIndex += 1;
    }

    return false;
  });
  return matches;
}

function normalizeActiveIndex(index: number, matchCount: number): number {
  if (matchCount === 0) return 0;
  return ((index % matchCount) + matchCount) % matchCount;
}

function buildState(state: EditorState, query: string, requestedIndex = 0): FindReplaceState {
  const matches = findMatches(state, query);
  return {
    query,
    matches,
    activeIndex: normalizeActiveIndex(requestedIndex, matches.length),
  };
}

function applyAction(
  transaction: Transaction,
  previous: FindReplaceState,
  nextState: EditorState,
): FindReplaceState {
  const action = transaction.getMeta(findReplaceKey) as FindReplaceAction | undefined;
  if (action?.type === 'clear') return buildState(nextState, '');
  if (action?.type === 'query') return buildState(nextState, action.query);

  const state = transaction.docChanged
    ? buildState(nextState, previous.query, previous.activeIndex)
    : previous;

  if (action?.type === 'move') {
    return { ...state, activeIndex: normalizeActiveIndex(state.activeIndex + action.delta, state.matches.length) };
  }
  if (action?.type === 'activate') {
    return { ...state, activeIndex: normalizeActiveIndex(action.index, state.matches.length) };
  }
  return state;
}

export const FindReplace = Extension.create({
  name: 'findReplace',

  addProseMirrorPlugins() {
    return [
      new Plugin<FindReplaceState>({
        key: findReplaceKey,
        state: {
          init: (_, state) => buildState(state, ''),
          apply: applyAction,
        },
        props: {
          decorations: (state) => {
            const pluginState = findReplaceKey.getState(state);
            if (!pluginState) return DecorationSet.empty;
            const decorations = pluginState.matches.map((match, index) => Decoration.inline(match.from, match.to, {
              class: index === pluginState.activeIndex ? 'editor-find-match editor-find-match-active' : 'editor-find-match',
              'data-find-match': String(index + 1),
            }));
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});

export function getFindReplaceState(editor: Editor): FindReplaceState {
  return findReplaceKey.getState(editor.state) ?? buildState(editor.state, '');
}

function dispatchAction(editor: Editor, action: FindReplaceAction): void {
  editor.view.dispatch(editor.state.tr.setMeta(findReplaceKey, action));
}

export function setFindQuery(editor: Editor, query: string): void {
  dispatchAction(editor, { type: 'query', query });
}

export function moveFindMatch(editor: Editor, delta: 1 | -1): void {
  dispatchAction(editor, { type: 'move', delta });
}

export function clearFind(editor: Editor): void {
  dispatchAction(editor, { type: 'clear' });
}

export function replaceCurrentMatch(editor: Editor, replacement: string): boolean {
  const state = getFindReplaceState(editor);
  const match = state.matches[state.activeIndex];
  if (!match) return false;

  const transaction = editor.state.tr
    .insertText(replacement, match.from, match.to)
    .setMeta(findReplaceKey, { type: 'activate', index: state.activeIndex });
  editor.view.dispatch(transaction);
  return true;
}

export function replaceAllMatches(editor: Editor, replacement: string): number {
  const state = getFindReplaceState(editor);
  if (state.matches.length === 0) return 0;

  const transaction = editor.state.tr;
  [...state.matches].reverse().forEach(({ from, to }) => {
    transaction.insertText(replacement, from, to);
  });
  transaction.setMeta(findReplaceKey, { type: 'query', query: state.query });
  editor.view.dispatch(transaction);
  return state.matches.length;
}
