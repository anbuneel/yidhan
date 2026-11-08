/**
 * Resolve once the window `load` event has fired, one task later.
 *
 * Work that serves the next visit (the service worker precache) or only reports on
 * this one (Sentry) waits for it, so it does not compete with the first paint and
 * is not counted against the page (item 61, steps 2 and 6). The extra task keeps a
 * chunk fetched here out of the load handlers.
 */
export function whenPageLoaded(): Promise<void> {
  if (typeof document === 'undefined' || document.readyState === 'complete') {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    window.addEventListener('load', () => setTimeout(resolve, 0), { once: true });
  });
}
