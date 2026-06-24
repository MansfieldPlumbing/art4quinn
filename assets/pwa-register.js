/* art4quinn — register the site-wide service worker (and evict any legacy one).
   Loaded by every entry page. Resolves the site root from its own URL so the
   worker is always registered at root scope, whether the site is served from a
   domain root or a GitHub Pages project subpath. */
(function () {
  if (!('serviceWorker' in navigator)) return;

  var src = (document.currentScript && document.currentScript.src) || '';
  // Site root = the folder containing this /assets/ dir.
  var root = src
    ? src.replace(/assets\/pwa-register\.js(?:[?#].*)?$/, '')
    : new URL('./', location.href).href;

  function register() {
    navigator.serviceWorker.register(root + 'sw.js').then(function () {
      // Evict any stale worker (e.g. the old "Magic Eraser" SW) that isn't ours.
      navigator.serviceWorker.getRegistrations().then(function (regs) {
        regs.forEach(function (r) {
          var w = r.active || r.waiting || r.installing;
          if (w && w.scriptURL && !/\/sw\.js$/.test(w.scriptURL)) r.unregister();
        });
      });
    }).catch(function () {});
  }

  if (document.readyState === 'complete') register();
  else addEventListener('load', register);
})();
