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

#push-banner{display:flex;align-items:center;gap:10px;margin:10px 12px;padding:10px 12px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;color:#065f46;font-size:14px;line-height:1.35}
#push-banner .pb-text{flex:1;min-width:0}
#push-banner .pb-go{background:#059669;color:#fff;border:0;border-radius:8px;padding:8px 12px;font-weight:600;font-size:13px;cursor:pointer;flex-shrink:0}
#push-banner .pb-go.busy{opacity:.6;pointer-events:none}
#push-banner .pb-x{background:transparent;border:0;color:#065f46;font-size:20px;line-height:1;cursor:pointer;padding:0 4px;flex-shrink:0}
`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  let isOn = false;            // is this device subscribed right now
  let detected = false;        // have we finished checking yet
  let bannerDismissed = false; // X pressed (only for this page load)
  let syncedFor = null;        // user id we last synced to the database
  let syncing = false;

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
    isOn = !!on;
    const b = $('push-btn');
    if (b) {
      b.classList.toggle('on', isOn);
      const label = isOn ? 'Payment reminders are on' : 'Turn on payment reminders';
      b.title = label;
      b.setAttribute('aria-label', label);
    }
    updateBanner();
  }

  function removeBanner() {
    const old = $('push-banner');
    if (old && old.parentNode) old.parentNode.removeChild(old);
  }

  function updateBanner() {
    const shouldShow = !!(EEE.state && EEE.state.user && EEE.state.role) &&
      detected && !isOn && !bannerDismissed;
    if (!shouldShow) { removeBanner(); return; }
    if ($('push-banner')) return;

    const needsInstall = isIOS() && !isInstalled();

    const bar = document.createElement('div');
    bar.id = 'push-banner';

    const text = document.createElement('div');
    text.className = 'pb-text';
    text.textContent = needsInstall
      ? '🔔 To get payment reminders: tap Share, then Add to Home Screen, and open the app from there.'
      : '🔔 Turn on payment reminders so you never miss a week. Tap the bell at the top, or press the button.';
    bar.appendChild(text);

    if (!needsInstall) {
      const go = document.createElement('button');
      go.className = 'pb-go';
      go.textContent = 'Turn on';
      go.addEventListener('click', async () => {
        go.classList.add('busy');
        try { await enable(); }
        catch (e) { console.error(e); toast('Could not turn on reminders: ' + (e && e.message ? e.message : e)); }
        go.classList.remove('busy');
      });
      bar.appendChild(go);
    }

    const x = document.createElement('button');
    x.className = 'pb-x';
    x.setAttribute('aria-label', 'Close');
    x.textContent = '\u00D7';
    x.addEventListener('click', () => { bannerDismissed = true; removeBanner(); });
    bar.appendChild(x);

    const host = document.querySelector('main') || document.body;
    host.insertBefore(bar, host.firstChild);
  }

  // Save this device's subscription under the current user.
  // It uses a safe database function, so a device that was saved under
  // another account earlier moves to the account that is signed in now.
  async function saveSubscription(sub) {
    const json = sub.toJSON();
    const r = await db.rpc('save_push_subscription', {
      p_endpoint: json.endpoint,
      p_subscription: json
    });
    return r.error || null;
  }

  // If this device is already subscribed in the browser, make sure the
  // database has it under the user who is signed in right now.
  async function syncToDatabase(sub) {
    if (syncing || !EEE.state || !EEE.state.user) return;
    const uid = EEE.state.user.id;
    if (syncedFor === uid) return;
    syncing = true;
    try {
      const err = await saveSubscription(sub);
      if (err) console.error('Push sync failed:', err.message);
      else syncedFor = uid;
    } catch (e) {
      console.error('Push sync error:', e);
    }
    syncing = false;
  }

  async function detect() {
    try {
      if (!supported() || Notification.permission !== 'granted') {
        detected = true; setState(false); return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      detected = true;
      setState(!!sub);
      if (sub) syncToDatabase(sub);
    } catch (e) {
      detected = true;
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
    const err = await saveSubscription(sub);
    if (err) {
      toast('Could not save: ' + err.message);
      return;
    }
    syncedFor = EEE.state.user.id;
    setState(true);
    toast('Payment reminders are on for this device.');
  }

  function ensureButton() {
    if (!EEE.state.role) { removeBanner(); syncedFor = null; return; }

    if (!$('push-btn')) {
      const bell = $('bell-btn');
      if (bell && bell.parentNode) {
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
        setState(isOn);
      }
    }

    // Re-check on every refresh so a user switch is noticed
    detect();
  }

  EEE.refreshHooks.push(ensureButton);
})();
