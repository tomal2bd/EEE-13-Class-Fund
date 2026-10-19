(function () {
  'use strict';
  const EEE = window.EEE;
  if (!EEE) return;
  const { toast } = EEE;

  const css = `
#install-btn{display:none;align-items:center;gap:6px;height:40px;padding:0 14px;background:#059669;color:#fff;border:0;border-radius:20px;font-weight:600;font-size:13px;cursor:pointer;flex-shrink:0;white-space:nowrap}
#install-btn.show{display:inline-flex}
#install-btn svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
#ios-install-box{position:fixed;left:12px;right:12px;bottom:16px;z-index:9999;background:#fff;color:#0f172a;border:1px solid #a7f3d0;border-radius:14px;padding:14px 16px;box-shadow:0 8px 30px rgba(0,0,0,.2);font-size:14px;line-height:1.45}
#ios-install-box button{margin-top:10px;background:#059669;color:#fff;border:0;border-radius:8px;padding:8px 14px;font-weight:600;cursor:pointer}
`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  let deferredPrompt = null;

  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }
  function isInstalled() {
    return window.navigator.standalone === true ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
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
      return;
    }
    if (isIOS()) { showIOSBox(); return; }
    toast('Use your browser menu and choose Install app or Add to Home screen.');
  }

  function ensureButton() {
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
    showButton(true);
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    showButton(false);
  });

  EEE.refreshHooks.push(ensureButton);
})();
