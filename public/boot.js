// Runs before first paint, from index.html. Two jobs:
// 1. Put the document in the theme the app will choose, so the landing shell and the
//    first React render agree. Mirrors readInitialTheme in src/hooks/useAppTheme.ts.
// 2. Hide the landing shell when it would be wrong: on any path but the home page, or
//    whenever src/appGate.ts will start the app shell instead of the public one: a
//    stored session, an auth callback in the URL, or share-target content. A signed-in
//    visitor or an OAuth return never sees the landing flash. Mirrors shouldStartApp;
//    src/appGate.test.ts runs this file to check the two agree.
// Kept as a file rather than inline because the CSP allows only same-origin scripts.
(function () {
  var root = document.documentElement;
  var path = location.pathname.replace(/\/+$/, '') || '/';
  var hide = path !== '/';
  try {
    var query = new URLSearchParams(location.search);
    var fragment = new URLSearchParams(location.hash.replace(/^#/, ''));
    if (
      query.has('code') ||
      query.has('error_description') ||
      query.get('reset') === 'true' ||
      query.get('share') === 'true' ||
      fragment.has('access_token') ||
      fragment.has('refresh_token') ||
      fragment.has('error_description')
    ) {
      hide = true;
    }
  } catch (error) {
    // No URLSearchParams: the shell shows, and the app replaces it as before.
  }
  try {
    var saved = localStorage.getItem('yidhan-theme');
    if (saved !== 'light' && saved !== 'dark') {
      saved =
        window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
          ? 'light'
          : 'dark';
    }
    root.setAttribute('data-theme', saved);
    if (!hide) {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (
          key &&
          ((key.indexOf('sb-') === 0 && key.indexOf('-auth-token') !== -1) ||
            key === 'yidhan-shared-content')
        ) {
          hide = true;
          break;
        }
      }
    }
  } catch (error) {
    // Storage unavailable: the shell shows in the OS theme, which the CSS handles.
  }
  if (hide) root.classList.add('boot-hidden');
})();
