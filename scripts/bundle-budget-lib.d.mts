export const KB: number;
export function isText(file: string): boolean;
export function transferBytes(distDir: string, relative: string): number | null;
export function gzipBytes(distDir: string, relative: string): number;
export function readEntry(distDir: string): {
  entries: string[];
  modulepreloads: string[];
  stylesheets: string[];
  preloads: string[];
  classicScripts: string[];
  closure: string[];
};
export function readPrecacheUrls(distDir: string): string[];
export function readBudget(repoRoot: string): Record<string, unknown>;
