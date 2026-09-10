// Runs before first paint, from index.html. Two jobs:
// 1. Put the document in the theme the app will choose, so the landing shell and the
//    first React render agree. Mirrors readInitialTheme in src/hooks/useAppTheme.ts.
// 2. Hide the landing shell when it would be wrong: on any path but the home page, or
//    when a session exists, so a signed-in visitor never sees the landing flash.
// Kept as a file rather than inline because the CSP allows only same-origin scripts.
(function () {
  var root = document.documentElement;
  var path = location.pathname.replace(/\/+$/, '') || '/';
  var hide = path !== '/';
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
        if (key && key.indexOf('sb-') === 0 && key.indexOf('-auth-token') !== -1) {
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
