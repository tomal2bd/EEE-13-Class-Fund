(function () {
  'use strict';
  const EEE = window.EEE;
  if (!EEE) return;
  const { toast } = EEE;

  const css = `
#install-btn{display:none;align-items:center;gap:6px;height:40px;padding:0 14px;background:#059669;color:#fff;border:0;border-radius:20px;font-weight:600;font-size:13px;cursor:pointer;flex-shrink:0;white-space:nowrap}
#install-btn.show{display:inline-flex}
#install-btn svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
#ios-install-box{position:fixed;left:12px;right:12px;bottom:16px;z-index:10001;background:#fff;color:#0f172a;border:1px solid #a7f3d0;border-radius:14px;padding:14px 16px;box-shadow:0 8px 30px rgba(0,0,0,.2);font-size:14px;line-height:1.45}
#ios-install-box button{margin-top:10px;background:#059669;color:#fff;border:0;border-radius:8px;padding:8px 14px;font-weight:600;cursor:pointer}

#setup-gate{position:fixed;inset:0;z-index:10000;background:#064e3b;display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto}
#setup-gate .sg-card{background:#fff;color:#0f172a;border-radius:16px;padding:22px 20px;width:100%;max-width:420px;box-shadow:0 12px 40px rgba(0,0,0,.35)}
#setup-gate h2{margin:0 0 6px;font-size:20px}
#setup-gate .sg-sub{margin:0 0 16px;font-size:14px;color:#475569;line-height:1.45}
#setup-gate .sg-step{border:1px solid #e2e8f0;border-radius:12px;padding:12px;margin-bottom:12px}
#setup-gate .sg-step.done{background:#ecfdf5;border-color:#a7f3d0}
#setup-gate .sg-title{font-weight:700;font-size:15px;margin-bottom:6px}
#setup-gate .sg-text{font-size:13.5px;color:#475569;line-height:1.5;margin-bottom:8px}
#setup-gate .sg-btn{width:100%;background:#059669;color:#fff;border:0;border-radius:10px;padding:11px 14px;font-weight:600;font-size:14px;cursor:pointer}
#setup-gate .sg-btn.busy{opacity:.6;pointer-events:none}
#setup-gate .sg-btn[disabled]{background:#cbd5e1;cursor:not-allowed}
#setup-gate .sg-warn{font-size:13px;color:#b91c1c;line-height:1.45;margin-top:6px}
`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  let deferredPrompt = null;

  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }
  // Phones and tablets only. Laptops and desktops are skipped.
  function isPhone() {
    const ua = navigator.userAgent || '';
    if (/android|iphone|ipad|ipod|mobile/i.test(ua)) return true;
    // New iPads say they are a Mac, but they have a touch screen
    return /macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
  }
  // True only when the app is open as the installed app (not a browser tab)
  function isStandalone() {
    return window.navigator.standalone === true ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  }
  // On Android the installed app and the browser share storage, so a note
  // saved while the installed app is open lets a browser tab know too.
  function getFlag() {
    try { return localStorage.getItem('eee_app_installed') === '1'; } catch (e) { return false; }
  }
  function setFlag(v) {
    try { if (v) localStorage.setItem('eee_app_installed', '1'); else localStorage.removeItem('eee_app_installed'); } catch (e) {}
  }
  function isInstalled() {
    if (isStandalone()) { setFlag(true); return true; }
    return getFlag();
  }

  function getButton() {
    return document.getElementById('install-btn');
  }

  function showButton(show) {
    const b = getButton();
    if (b) b.classList.toggle('show', !!show);
  }

  function showIOSBox() {
    if (document.getElementById('ios-install-box')) return;
    const box = document.createElement('div');
    box.id = 'ios-install-box';
    box.innerHTML = '<b>Install on iPhone</b><br>1. Tap the <b>Share</b> button (square with an arrow) in Safari.<br>2. Scroll and tap <b>Add to Home Screen</b>.<br>3. Open the app from your Home Screen.';
    const ok = document.createElement('button');
    ok.textContent = 'Got it';
    ok.addEventListener('click', () => box.remove());
    box.appendChild(ok);
    document.body.appendChild(box);
  }

  async function onInstallClick() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      try { await deferredPrompt.userChoice; } catch (e) {}
      deferredPrompt = null;
      showButton(false);
      updateGate();
      return;
    }
    if (isIOS()) { showIOSBox(); return; }
    toast('Use your browser menu and choose Install app or Add to Home screen.');
  }

  // ---------- Required setup gate ----------
  // Signed-in users must (1) install the app and (2) turn on notifications.
  // Until both are done, this full-screen box stays on top.

  function removeGate() {
    const g = document.getElementById('setup-gate');
    if (g && g.parentNode) g.parentNode.removeChild(g);
  }

  function mk(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }

  function updateGate() {
    const loggedIn = !!(EEE.state && EEE.state.user && EEE.state.role);
    const push = EEE.push;
    if (!isPhone() || !loggedIn || !push || !push.detected()) { removeGate(); return; }

    const installed = isInstalled();
    const on = push.isOn();
    if (installed && on) { removeGate(); return; }

    let gate = document.getElementById('setup-gate');
    if (!gate) {
      gate = mk('div');
      gate.id = 'setup-gate';
      document.body.appendChild(gate);
    }
    gate.textContent = '';

    const card = mk('div', 'sg-card');
    card.appendChild(mk('h2', '', 'Set up the app'));
    card.appendChild(mk('p', 'sg-sub', 'To use EEE-13 · Class Fund, please install the app and turn on payment reminders.'));

    // Step 1: install
    const s1 = mk('div', 'sg-step' + (installed ? ' done' : ''));
    s1.appendChild(mk('div', 'sg-title', (installed ? '✓ ' : '1. ') + 'Install the app'));
    if (!installed) {
      let help;
      if (isIOS()) help = 'On iPhone: tap Share in Safari, then Add to Home Screen, then open the app from your Home Screen.';
      else if (deferredPrompt) help = 'Tap the button below to install.';
      else help = 'Use your browser menu and choose Install app or Add to Home screen. If you already installed it, open the app from your Home Screen or app list.';
      s1.appendChild(mk('div', 'sg-text', help));
      const b1 = mk('button', 'sg-btn', 'Install App');
      b1.addEventListener('click', onInstallClick);
      s1.appendChild(b1);
    }
    card.appendChild(s1);

    // Step 2: notifications
    const s2 = mk('div', 'sg-step' + (on ? ' done' : ''));
    s2.appendChild(mk('div', 'sg-title', (on ? '✓ ' : '2. ') + 'Turn on payment reminders'));
    if (!on) {
      const denied = ('Notification' in window) && Notification.permission === 'denied';
      s2.appendChild(mk('div', 'sg-text', installed
        ? 'You will get all payment reminders on this phone.'
        : 'Install the app first, then this step opens.'));
      const b2 = mk('button', 'sg-btn', 'Turn on reminders');
      if (!installed) b2.disabled = true;
      b2.addEventListener('click', async () => {
        b2.classList.add('busy');
        try { await push.enable(); }
        catch (e) { console.error(e); toast('Could not turn on reminders: ' + (e && e.message ? e.message : e)); }
        b2.classList.remove('busy');
        updateGate();
      });
      s2.appendChild(b2);
      if (installed && denied) {
        s2.appendChild(mk('div', 'sg-warn', 'Notifications are blocked. Open your phone Settings, allow notifications for this app, then come back and press the button.'));
      }
    }
    card.appendChild(s2);

    gate.appendChild(card);
  }

  EEE.updateGate = updateGate;

  // ---------- Install button next to the bell ----------

  function ensureButton() {
    updateGate();
    if (!isPhone()) return;
    if (isInstalled()) return;
    if (!EEE.state || !EEE.state.role) return;
    if (getButton()) return;

    const anchor = document.getElementById('push-btn') || document.getElementById('bell-btn');
    if (!anchor || !anchor.parentNode) return;

    const b = document.createElement('button');
    b.id = 'install-btn';
    b.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg><span>Install App</span>';
    b.addEventListener('click', onInstallClick);
    anchor.parentNode.insertBefore(b, anchor);

    // iPhone never fires beforeinstallprompt, so show the button directly
    if (isIOS()) showButton(true);
    else if (deferredPrompt) showButton(true);
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    setFlag(false); // the browser only offers install when the app is not installed
    showButton(true);
    updateGate();
  });

  window.addEventListener('appinstalled', () => {
    setFlag(true);
    deferredPrompt = null;
    showButton(false);
    updateGate();
  });

  EEE.refreshHooks.push(ensureButton);
})();
