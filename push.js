(function () {
  'use strict';
  const EEE = window.EEE;
  if (!EEE) return;
  const { db, $, el, toast } = EEE;

  // Public VAPID key (safe to keep in the website code)
  const VAPID_PUBLIC_KEY = 'BGUZWrIqUeMH7GzfMsZDW4v55XkvPx8mGPAwfNAP7LzylCKxusqEVogNOtYjO-Uh1dLmtMFecXv0F57IMT5l2v4';

  const css = `
#push-btn{position:relative;width:40px;height:40px;display:grid;place-items:center;background:#fff;border:1px solid #e2e8f0;border-radius:50%;cursor:pointer;padding:0;color:#64748b;flex-shrink:0}
#push-btn svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
#push-btn .slash{display:block}
#push-btn.on{background:#059669;border-color:#059669;color:#fff}
#push-btn.on .slash{display:none}
#push-btn.busy{opacity:.6;pointer-events:none}
`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  function urlBase64ToUint8Array(b64) {
    const padding = '='.repeat((4 - (b64.length % 4)) % 4);
    const base64 = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  function supported() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }
  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }
  function isInstalled() {
    return window.navigator.standalone === true ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  }

  function setState(on) {
    const b = $('push-btn');
    if (!b) return;
    b.classList.toggle('on', !!on);
    const label = on ? 'Payment reminders are on' : 'Turn on payment reminders';
    b.title = label;
    b.setAttribute('aria-label', label);
  }

  async function detect() {
    if (!supported() || Notification.permission !== 'granted') { setState(false); return; }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setState(!!sub);
    } catch (e) {
      setState(false);
    }
  }

  async function enable() {
    if (!supported()) {
      if (isIOS() && !isInstalled()) {
        toast('On iPhone, first add this app to your Home Screen (Share, then Add to Home Screen) and open it from there.');
      } else {
        toast('This browser does not support notifications.');
      }
      return;
    }
    if (!EEE.state.user) { toast('Please sign in first.'); return; }

    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      setState(false);
      toast('Notifications are blocked. Please allow them in your browser settings.');
      return;
    }

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }
    const json = sub.toJSON();
    const r = await db.from('push_subscriptions').insert({
      user_id: EEE.state.user.id,
      endpoint: json.endpoint,
      subscription: json
    });
    // 23505 = this device is already saved, which is fine
    if (r.error && r.error.code !== '23505') {
      toast('Could not save: ' + r.error.message);
      return;
    }
    setState(true);
    toast('Payment reminders are on for this device.');
  }

  function ensureButton() {
    if (!EEE.state.role || $('push-btn')) return;
    const bell = $('bell-btn');
    if (!bell || !bell.parentNode) return;

    const b = el('button', '');
    b.id = 'push-btn';
    b.innerHTML = '<svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/><line class="slash" x1="3" y1="3" x2="21" y2="21"/></svg>';
    b.addEventListener('click', async () => {
      b.classList.add('busy');
      try { await enable(); }
      catch (e) { console.error(e); toast('Could not turn on reminders: ' + (e && e.message ? e.message : e)); }
      b.classList.remove('busy');
    });
    bell.parentNode.insertBefore(b, bell);
    setState(false);
    detect();
  }

  EEE.refreshHooks.push(ensureButton);
})();
