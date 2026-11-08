import type { Plugin } from 'vite';

export const DOCUMENT_MODULE: string;
export function publicPageForPath(pathname: string, pageNames: readonly string[]): string | null;
export function publicPageDocumentsPlugin(): Plugin;
export function writePublicPageDocuments(root?: string, distDir?: string): Promise<string[]>;
