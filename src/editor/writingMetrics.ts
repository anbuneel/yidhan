export interface WritingMetrics {
  words: number;
  characters: number;
  readingMinutes: number;
}

export function calculateWritingMetrics(text: string): WritingMetrics {
  const normalized = text.trim();
  const words = normalized ? normalized.split(/\s+/u).length : 0;
  return {
    words,
    characters: Array.from(text).length,
    readingMinutes: words === 0 ? 0 : Math.max(1, Math.ceil(words / 200)),
  };
}
