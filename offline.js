// Registers the service worker and shows a small badge while the site is
// being saved for offline use, then "Ready offline" for a few seconds.
(function () {
  if (!('serviceWorker' in navigator)) return;
  // sw.js sits next to this script, so this works at "/" and under "/app/".
  var here = (document.currentScript && document.currentScript.src) || location.href;
  var swUrl = new URL('sw.js', here).href;

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

  navigator.serviceWorker.addEventListener('message', function (e) {
    var p = e.data;
    if (!p || p.type !== 'offline-progress' || !p.total) return;
    if (p.done < p.total) show('Saving for offline… ' + p.done + ' / ' + p.total);
    else if (p.failed) show('Saved, but ' + p.failed + ' files failed — reload to retry', true);
    else if (!sessionStorage.getItem('offline-ready-shown')) {
      try { sessionStorage.setItem('offline-ready-shown', '1'); } catch (_) {}
      show('Ready offline ✓', true);
    }
  });

  window.addEventListener('load', function () {
    navigator.serviceWorker.register(swUrl).then(function () {
      return navigator.serviceWorker.ready;
    }).then(function (reg) {
      if (reg.active) reg.active.postMessage('offline-status');
    }).catch(function () {});
  });
})();
