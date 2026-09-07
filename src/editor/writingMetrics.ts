import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

export interface WritingMetrics {
  words: number;
  characters: number;
  readingMinutes: number;
}

function calculateMetrics(wordText: string, characterText: string): WritingMetrics {
  const normalized = wordText.trim();
  const words = normalized ? normalized.split(/\s+/u).length : 0;
  return {
    words,
    characters: Array.from(characterText).length,
    readingMinutes: words === 0 ? 0 : Math.max(1, Math.ceil(words / 200)),
  };
}

export function calculateWritingMetrics(text: string): WritingMetrics {
  return calculateMetrics(text, text);
}

export function calculateDocumentWritingMetrics(doc: ProseMirrorNode): WritingMetrics {
  const wordText = doc.textBetween(0, doc.content.size, ' ');
  const characterText = doc.textBetween(0, doc.content.size, '');
  // Block separators make words from adjacent paragraphs distinct, but they
  // are document structure rather than characters the writer entered.
  return calculateMetrics(wordText, characterText);
}
