// Registers the service worker and shows a small badge while the site is
// being saved for offline use, then "Ready offline" for a few seconds.
// Progress is read straight from the cache rather than from worker messages,
// so it also works on pages just outside the worker's scope (Webflow Cloud
// serves the app's home page at "/app", while the scope is "/app/").
(function () {
  if (!('serviceWorker' in navigator) || !window.caches) return;
  // sw.js sits next to this script, so this works at "/" and under "/app/".
  var here = (document.currentScript && document.currentScript.src) || location.href;
  var swUrl = new URL('sw.js', here).href;
  var listUrl = new URL('precache.json', here).href;

  var badge;
  function show(text, done) {
    if (!badge) {
      badge = document.createElement('div');
      badge.style.cssText =
        'position:fixed;left:12px;bottom:12px;z-index:2147483647;padding:8px 12px;' +
        'border-radius:8px;font:500 13px/1.2 -apple-system,system-ui,sans-serif;' +
        'color:#fff;background:rgba(20,20,20,.85);pointer-events:none;transition:opacity .4s';
      document.body.appendChild(badge);
    }
    badge.textContent = text;
    badge.style.opacity = '1';
    if (done) setTimeout(function () { badge.style.opacity = '0'; }, 4000);
  }

  function shownOnce() {
    try {
      if (sessionStorage.getItem('offline-ready-shown')) return true;
      sessionStorage.setItem('offline-ready-shown', '1');
    } catch (_) {}
    return false;
  }

  async function watch(reg) {
    var list;
    try { list = await (await fetch(listUrl, { cache: 'no-store' })).json(); }
    catch (_) { return; } // offline: nothing to report, the copy is already saved
    var total = list.files.length;
    var name = 'reframe-systems-' + list.version;
    for (;;) {
      var done = 0;
      if (await caches.has(name)) done = (await (await caches.open(name)).keys()).length;
      var installing = !!(reg.installing || reg.waiting);
      if (done >= total) {
        if (!shownOnce()) show('Ready offline ✓', true);
        return;
      }
      if (!installing && reg.active && done > 0) {
        show('Saved, but ' + (total - done) + ' files failed — reload to retry', true);
        return;
      }
      show('Saving for offline… ' + done + ' / ' + total);
      await new Promise(function (r) { setTimeout(r, 1500); });
    }
  }

  window.addEventListener('load', function () {
    navigator.serviceWorker.register(swUrl).then(watch).catch(function () {});
  });
})();
