import DOMPurify from 'dompurify';
export function paragraphs(html: string): string[] {
  const doc = new DOMParser().parseFromString(DOMPurify.sanitize(html), 'text/html');
  const blocks = [...doc.body.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,pre,blockquote')].filter(el => !el.querySelector('p,li,pre,blockquote'));
  return (blocks.length ? blocks.map(el => el.textContent ?? '') : [doc.body.textContent ?? '']).map(text => text.trim()).filter(Boolean);
}
export function paragraphChanges(local: string[], server: string[]): { removed: string[]; added: string[] } {
  const unmatched = (a: string[], b: string[]) => {
    const counts = new Map<string, number>();
    for (const line of b) counts.set(line, (counts.get(line) ?? 0) + 1);
    return a.filter(line => { const n = counts.get(line) ?? 0; if (n) { counts.set(line, n - 1); return false; } return true; });
  };
  return { removed: unmatched(server, local), added: unmatched(local, server) };
}
export function wordCount(html: string): number { return paragraphs(html).join(' ').split(/\s+/).filter(Boolean).length; }
