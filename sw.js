// Offline support for the Reframe Systems copy.
// The file list lives in precache.json, which _mirror.py regenerates; sw.js
// carries the version so browsers notice when it changes. Works at the domain
// root or under a mount path (e.g. /app/ on Webflow Cloud): everything is
// resolved against this worker's scope.
const VERSION = '1c4f450c29';
const CACHE = 'reframe-systems-' + VERSION;
const CONCURRENCY = 6;
const SCOPE = self.registration.scope; // e.g. "https://host/app/"

let progress = { done: 0, total: 0, complete: false };

// The same file can be requested as "(1)" or "%281%29", "@" or "%40"; use one
// canonical cache key (full URL, no query) so every spelling hits the cache.
// Images and video may live on Webflow's CDN, hence full URLs, not paths.
function keyFor(u) {
  const url = new URL(u, SCOPE);
  let path = url.pathname;
  try { path = decodeURIComponent(path); } catch (e) {}
  return new URL(path, url.origin).href;
}

async function broadcast() {
  for (const c of await self.clients.matchAll({ includeUncontrolled: true })) {
    c.postMessage({ type: 'offline-progress', ...progress });
  }
}

async function precache() {
  const list = await (await fetch(new URL('precache.json', SCOPE), { cache: 'no-store' })).json();
  const cache = await caches.open(CACHE);
  const files = list.files;
  progress = { done: 0, total: files.length, complete: false };
  let i = 0, failed = 0;
  async function worker() {
    while (i < files.length) {
      const url = files[i++];
      try {
        if (!(await cache.match(keyFor(url)))) {
          // CORS mode so CDN files are stored readable (Webflow's CDN allows it),
          // which the video byte-range handling below needs.
          const res = await fetch(url, { mode: 'cors', cache: 'reload' });
          if (res.ok) await cache.put(keyFor(url), res);
          else failed++;
        }
      } catch (e) { failed++; }
      progress.done++;
      if (progress.done % 20 === 0) broadcast();
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  progress.complete = failed === 0;
  progress.failed = failed;
  broadcast();
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'offline-status') {
    (async () => {
      // A fresh page asking after install finished: report from the cache.
      if (!progress.total) {
        const list = await (await caches.open(CACHE)).match(keyFor('precache.json'));
        const total = list ? (await list.json()).files.length : 0;
        progress = { done: total, total, complete: total > 0 };
      }
      event.source.postMessage({ type: 'offline-progress', ...progress });
    })();
  }
});

// Safari asks for <video> in byte ranges and refuses a plain 200 reply,
// so slice the cached file and answer 206 Partial Content.
async function rangeResponse(request, cached) {
  const buf = await cached.arrayBuffer();
  const m = /bytes=(\d*)-(\d*)/.exec(request.headers.get('range'));
  let start = m[1] ? parseInt(m[1], 10) : 0;
  let end = m[2] ? parseInt(m[2], 10) : buf.byteLength - 1;
  if (!m[1] && m[2]) { start = buf.byteLength - parseInt(m[2], 10); end = buf.byteLength - 1; }
  end = Math.min(end, buf.byteLength - 1);
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Type': cached.headers.get('Content-Type') || 'video/mp4',
      'Content-Range': `bytes ${start}-${end}/${buf.byteLength}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
    },
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === location.origin;

  // Pages are linked as /products.html; also accept /products and /.
  let key = url.href;
  if (sameOrigin) {
    let path = url.pathname;
    if (path.endsWith('/')) path += 'index.html';
    else if (req.mode === 'navigate' && !/\.[a-z0-9]+$/i.test(path)) path += '.html';
    key = new URL(path, url.origin).href;
  }
  key = keyFor(key);

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(key);
    if (cached) {
      return req.headers.has('range') ? rangeResponse(req, cached) : cached;
    }
    try {
      const res = await fetch(req);
      // Pick up same-origin files not in the list (e.g. .webm) for next time.
      if (sameOrigin && res.status === 200 && !req.headers.has('range')) cache.put(key, res.clone());
      return res;
    } catch (e) {
      if (req.mode === 'navigate') return (await cache.match(keyFor('index.html'))) || Response.error();
      return Response.error();
    }
  })());
});
