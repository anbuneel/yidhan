/**
 * The theme, and the two places it has to be written: the document attribute the CSS
 * reads, and localStorage so the next visit opens the same way.
 *
 * A first-time visitor gets their OS preference rather than a default, so the landing
 * page arrives in the theme their machine is already in.
 */

import { useCallback, useEffect, useState } from 'react';
import type { Theme } from '../types';

const STORAGE_KEY = 'yidhan-theme';

function readInitialTheme(): Theme {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  if (window.matchMedia?.('(prefers-color-scheme: light)').matches) return 'light';
  return 'dark';
}

export function useAppTheme(): { theme: Theme; toggleTheme: () => void } {
  const [theme, setTheme] = useState<Theme>(readInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'light' ? 'dark' : 'light'));
  }, []);

  return { theme, toggleTheme };
}
