export interface SearchDateFilter {
  value: string;
  precision: 'month' | 'day';
}

export interface SearchQueryFilters {
  tags: string[];
  pinned: boolean | null;
  before: SearchDateFilter[];
  after: SearchDateFilter[];
}

export interface SearchTextTerm {
  value: string;
  normalized: string;
  quoted: boolean;
}

export interface ParsedSearchQuery {
  filters: SearchQueryFilters;
  textTerms: SearchTextTerm[];
}

interface QueryToken {
  value: string;
  quoted: boolean;
}

function tokenizeQuery(query: string): QueryToken[] {
  const tokens: QueryToken[] = [];
  let index = 0;

  while (index < query.length) {
    while (/\s/.test(query[index] ?? '')) index += 1;
    if (index >= query.length) break;

    const startsQuoted = query[index] === '"';
    let value = '';
    let inQuotes = false;

    while (index < query.length) {
      const character = query[index];
      if (character === '"') {
        inQuotes = !inQuotes;
        index += 1;
        continue;
      }
      if (!inQuotes && /\s/.test(character)) break;
      value += character;
      index += 1;
    }

    if (value) tokens.push({ value, quoted: startsQuoted });
  }

  return tokens;
}

function parseDateFilter(value: string): SearchDateFilter | null {
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;

  if (!match[3]) return { value, precision: 'month' };

  const day = Number(match[3]);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > daysInMonth) return null;

  return { value, precision: 'day' };
}

function textTerm(token: QueryToken): SearchTextTerm {
  return {
    value: token.value,
    normalized: token.value.toLowerCase(),
    quoted: token.quoted,
  };
}

/**
 * Split a library query into plaintext metadata filters and free-text terms.
 * Invalid supported operators are ignored. Unknown text remains in the free-text remainder.
 */
export function parseSearchQuery(query: string): ParsedSearchQuery {
  const filters: SearchQueryFilters = {
    tags: [],
    pinned: null,
    before: [],
    after: [],
  };
  const textTerms: SearchTextTerm[] = [];

  for (const token of tokenizeQuery(query)) {
    if (!token.quoted) {
      const separator = token.value.indexOf(':');
      const operator = separator === -1
        ? ''
        : token.value.slice(0, separator).toLowerCase();
      const operand = separator === -1 ? '' : token.value.slice(separator + 1).trim();

      if (operator === 'tag') {
        if (operand.length >= 1 && operand.length <= 20) {
          filters.tags.push(operand.toLowerCase());
        }
        continue;
      }

      if (operator === 'is') {
        if (operand.toLowerCase() === 'pinned') filters.pinned = true;
        continue;
      }

      if (operator === 'before' || operator === 'after') {
        const date = parseDateFilter(operand);
        if (date) filters[operator].push(date);
        continue;
      }
    }

    textTerms.push(textTerm(token));
  }

  return { filters, textTerms };
}
