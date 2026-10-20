/* fixes.js - EEE-13 Class Fund
   Adds: opening splash (logo + name), header logo (click = go Home), animated three-line menu button.
   Load this LAST, after dash.js */

/* ---------- Opening splash: logo + name, then fades away ---------- */
(function () {
  var LOGO = 'icon-192.png';
  var SHOW_MS = 1500;   // how long the splash stays
  var FADE_MS = 450;    // fade out time

  // show once each time the app is opened (not on every page change)
  try {
    if (sessionStorage.getItem('eee_splash_done')) return;
    sessionStorage.setItem('eee_splash_done', '1');
  } catch (e) { /* storage not available, still show it */ }

  var css =
    '#eee-splash{position:fixed;inset:0;z-index:100000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;' +
    'background:linear-gradient(135deg,#022c22,#047857 60%,#10b981);transition:opacity ' + FADE_MS + 'ms ease}' +
    '#eee-splash.out{opacity:0;pointer-events:none}' +
    '#eee-splash img{width:112px;height:112px;border-radius:26px;background:#fff;padding:8px;box-sizing:border-box;' +
    'box-shadow:0 14px 40px rgba(0,0,0,.35);animation:eeeLogo .8s cubic-bezier(.2,.9,.3,1.2) both}' +
    '#eee-splash .t{color:#fff;font-family:"Segoe UI",Arial,sans-serif;font-size:24px;font-weight:800;letter-spacing:.5px;' +
    'animation:eeeText .7s ease .35s both}' +
    '#eee-splash .s{color:rgba(255,255,255,.8);font-family:"Segoe UI",Arial,sans-serif;font-size:14px;font-weight:600;margin-top:-10px;' +
    'animation:eeeText .7s ease .55s both}' +
    '@keyframes eeeLogo{from{opacity:0;transform:scale(.5)}to{opacity:1;transform:scale(1)}}' +
    '@keyframes eeeText{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}' +
    '@media (prefers-reduced-motion:reduce){#eee-splash img,#eee-splash .t,#eee-splash .s{animation:none}}';

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  var box = document.createElement('div');
  box.id = 'eee-splash';
  box.innerHTML = '<img src="' + LOGO + '" alt=""><div class="t">EEE-13 · Class Fund</div><div class="s">Loading...</div>';
  document.body.appendChild(box);

  setTimeout(function () {
    box.classList.add('out');
    setTimeout(function () { box.remove(); }, FADE_MS + 50);
  }, SHOW_MS);
})();

(function () {
  var LOGO_SRC = 'icon-192.png'; // change here if you want another logo file

  function init() {
    var tl = document.querySelector('.top .tl');
    var menuBtn = document.getElementById('menu-btn');
    var side = document.getElementById('side');
    var top = document.querySelector('.top');
    if (!tl || !menuBtn || !side) return;

    /* 1. logo, placed to the LEFT of the three-line button */
    if (!document.getElementById('top-logo')) {
      var logo = document.createElement('a');
      logo.id = 'top-logo';
      logo.className = 'top-logo';
      logo.href = '#';
      logo.setAttribute('aria-label', 'Go to home page');
      logo.innerHTML = '<img src="' + LOGO_SRC + '" alt="EEE-13 Class Fund">';
      tl.insertBefore(logo, tl.firstChild);

      logo.addEventListener('click', function (e) {
        e.preventDefault();
        // close drawer / profile menu if open
        var scrim = document.getElementById('scrim');
        if (side.classList.contains('open') && scrim) scrim.click();
        var avmenu = document.getElementById('avmenu');
        if (avmenu) avmenu.hidden = true;
        // go to the home (overview) page
        var navs = document.querySelectorAll('#nav .nav');
        var home = null;
        for (var i = 0; i < navs.length; i++) {
          if (/overview|dashboard|home/i.test(navs[i].textContent)) { home = navs[i]; break; }
        }
        if (!home && navs.length) home = navs[0];
        if (home) home.click();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    /* 2. three animated lines inside the menu button */
    menuBtn.innerHTML = '<span class="mb-lines"><i></i><i></i><i></i></span>';

    function sync() {
      menuBtn.classList.toggle('open', side.classList.contains('open'));
      menuBtn.setAttribute('aria-label', side.classList.contains('open') ? 'Close menu' : 'Open menu');
    }
    new MutationObserver(sync).observe(side, { attributes: true, attributeFilter: ['class'] });
    menuBtn.addEventListener('click', function () { setTimeout(sync, 30); });
    sync();

    /* 3. tell the CSS how tall the header is, so the drawer opens below it */
    function setH() {
      var h = top ? top.offsetHeight : 0;
      if (h > 0) document.documentElement.style.setProperty('--toph', h + 'px');
    }
    setH();
    window.addEventListener('resize', setH);
    if (window.ResizeObserver && top) new ResizeObserver(setH).observe(top);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
