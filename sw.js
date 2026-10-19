const CACHE = 'eee13-fund-v1';
const SHELL = ['./', './index.html', './style.css', './circuit.css', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
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
  // শুধু নিজের সাইটের GET রিকোয়েস্ট। Supabase ডেটা কখনো ক্যাশ হবে না।
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  // আগে নেটওয়ার্ক, না পেলে ক্যাশ। তাই আপডেট সবসময় সাথে সাথে আসবে।
  e.respondWith(
    fetch(req)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req))
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
