// Bump CACHE and V together whenever you change ?v=N in index.html
const CACHE = 'eee13-fund-v5';
const V = '?v=5';
const FILES = ['style.css','circuit.css','fixes.css','splash.css','motion.css','app.js','payments.js','admin.js','admin-extra.js','dash.js','fixes.js','push.js','install.js','splash.js'];
const SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'].concat(FILES.map(f => './' + f + V));

self.addEventListener('install', e => {
  // one missing file must not break the install
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;

  const isPage = req.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/');
  if (isPage) {
    // the page itself: always ask the server first, so new ?v=N numbers are seen at once
    e.respondWith(
      fetch(req, { cache: 'no-cache' })
        .then(res => { if (res.ok) { const c = res.clone(); caches.open(CACHE).then(x => x.put(req, c)); } return res; })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // other files: answer from the phone's cache straight away (fast).
  // Files with ?v=N are new URLs whenever you bump N, so they are always fresh.
  // Files without ?v (icons, manifest) refresh quietly in the background.
  e.respondWith(
    caches.match(req).then(cached => {
      const net = fetch(req, { cache: 'no-cache' }).then(res => {
        if (res.ok) { const c = res.clone(); caches.open(CACHE).then(x => x.put(req, c)); }
        return res;
      });
      if (cached) {
        if (!url.search.includes('v=')) net.catch(() => {});
        return cached;
      }
      return net;
    })
  );
});

// ===== Push Notification =====
self.addEventListener('push', e => {
  let data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch (err) {
    data = { body: e.data ? e.data.text() : '' };
  }
  const title = data.title || 'Class Fund Reminder';
  const options = {
    body: data.body || 'Your payment for this week is not approved yet.',
    icon: './icon-192.png',
    badge: './icon-192.png',
    data: { url: data.url || './' }
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.startsWith(self.registration.scope) && 'focus' in c) return c.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});
