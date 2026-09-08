import { escapeHtml } from './sanitize';

interface TextMatch {
  start: number;
  end: number;
}

function findTextMatches(text: string, terms: readonly string[]): TextMatch[] {
  const normalizedText = text.toLowerCase();
  const normalizedTerms = [...new Set(terms.map((term) => term.toLowerCase()))]
    .filter(Boolean);
  const matches: TextMatch[] = [];

  for (const term of normalizedTerms) {
    let start = 0;
    while (start <= normalizedText.length - term.length) {
      const matchStart = normalizedText.indexOf(term, start);
      if (matchStart === -1) break;
      matches.push({ start: matchStart, end: matchStart + term.length });
      start = matchStart + Math.max(term.length, 1);
    }
  }

  matches.sort((a, b) => a.start - b.start || b.end - a.end);

  const merged: TextMatch[] = [];
  for (const match of matches) {
    const previous = merged.at(-1);
    if (previous && match.start < previous.end) {
      previous.end = Math.max(previous.end, match.end);
    } else {
      merged.push({ ...match });
    }
  }
  return merged;
}

export function highlightSearchText(text: string, terms: readonly string[]): string {
  const matches = findTextMatches(text, terms);
  if (matches.length === 0) return escapeHtml(text);

  let cursor = 0;
  let highlighted = '';
  for (const match of matches) {
    highlighted += escapeHtml(text.slice(cursor, match.start));
    highlighted += `<mark>${escapeHtml(text.slice(match.start, match.end))}</mark>`;
    cursor = match.end;
  }
  return highlighted + escapeHtml(text.slice(cursor));
}

export function buildSearchSnippet(
  text: string,
  terms: readonly string[],
  contextLength = 24
): string | null {
  const matches = findTextMatches(text, terms);
  if (matches.length === 0) return null;

  const windows = matches.map((match) => ({
    start: Math.max(0, match.start - contextLength),
    end: Math.min(text.length, match.end + contextLength),
  }));
  const mergedWindows: TextMatch[] = [];

  for (const window of windows) {
    const previous = mergedWindows.at(-1);
    if (previous && window.start <= previous.end) {
      previous.end = Math.max(previous.end, window.end);
    } else {
      mergedWindows.push({ ...window });
    }
  }

  return mergedWindows.map((window) => {
    const prefix = window.start > 0 ? '…' : '';
    const suffix = window.end < text.length ? '…' : '';
    return `${prefix}${highlightSearchText(text.slice(window.start, window.end), terms)}${suffix}`;
  }).join(' ');
}
