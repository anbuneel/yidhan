export const LIBRARY_SEARCH_INPUT_ID = 'library-search-input';
export const DEMO_SEARCH_INPUT_ID = 'demo-search-input';

function focusSearchInput(inputId: string): boolean {
  const input = document.getElementById(inputId);
  if (!(input instanceof HTMLInputElement)) {
    return false;
  }

  input.focus();
  return document.activeElement === input;
}

export function scheduleSearchFocus(inputId: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.requestAnimationFrame(() => {
    if (focusSearchInput(inputId)) {
      return;
    }

    window.requestAnimationFrame(() => {
      if (focusSearchInput(inputId)) {
        return;
      }

      window.setTimeout(() => {
        focusSearchInput(inputId);
      }, 0);
    });
  });
}
