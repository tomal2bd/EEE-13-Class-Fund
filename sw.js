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
