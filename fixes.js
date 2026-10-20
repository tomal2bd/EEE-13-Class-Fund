/* fixes.js - EEE-13 Class Fund
   Adds: opening splash (ring draws, logo shines, coins rise, iris-close exit),
   header logo (click = go Home), animated three-line menu button.
   Load this LAST, after dash.js */

/* ---------- Opening splash ---------- */
(function () {
  var LOGO = 'icon-192.png';
  var SHOW_MS = 2600;   // how long before it starts closing
  var CLOSE_MS = 600;   // iris-close time
  var GAP_MIN = 10;     // show again only if the last time was more than this many minutes ago

  // A normal refresh right after opening should not show the splash again
  try {
    var last = Number(localStorage.getItem('eee_splash_at') || 0);
    if (Date.now() - last < GAP_MIN * 60 * 1000) return;
    localStorage.setItem('eee_splash_at', String(Date.now()));
  } catch (e) { /* storage not available: show it */ }

  var css =
    '#eee-splash{position:fixed;inset:0;z-index:100000;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;' +
    'background:radial-gradient(circle at 50% 40%,#065f46 0%,#022c22 70%);clip-path:circle(150% at 50% 50%);' +
    'transition:clip-path ' + CLOSE_MS + 'ms cubic-bezier(.7,0,.3,1)}' +
    '#eee-splash.out{clip-path:circle(0% at 50% 50%)}' +
    '#eee-splash .core{position:relative;width:170px;height:170px;display:flex;align-items:center;justify-content:center;animation:eeeCore 2.3s ease both}' +
    '#eee-splash svg{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg)}' +
    '#eee-splash .ring{fill:none;stroke:#fbbf24;stroke-width:4;stroke-linecap:round;stroke-dasharray:439;stroke-dashoffset:439;' +
    'filter:drop-shadow(0 0 8px rgba(251,191,36,.8));animation:eeeRing 1.3s cubic-bezier(.6,0,.2,1) .15s forwards}' +
    '#eee-splash .lg{position:relative;width:104px;height:104px;border-radius:26px;overflow:hidden;background:#fff;' +
    'box-shadow:0 0 0 0 rgba(251,191,36,.6),0 12px 36px rgba(0,0,0,.45);animation:eeeLogo .7s cubic-bezier(.2,.9,.3,1.3) .7s both,eeePulse 1.2s ease 1.5s}' +
    '#eee-splash .lg img{width:100%;height:100%;object-fit:contain;display:block}' +
    '#eee-splash .lg::after{content:"";position:absolute;top:0;left:-70%;width:45%;height:100%;' +
    'background:linear-gradient(100deg,transparent,rgba(255,255,255,.85),transparent);transform:skewX(-20deg);animation:eeeShine .9s ease 1.35s forwards}' +
    '#eee-splash .nm{display:flex;margin-top:26px;font-family:"Segoe UI",Arial,sans-serif;font-size:34px;font-weight:900;color:#fff;letter-spacing:2px}' +
    '#eee-splash .nm span{display:inline-block;opacity:0;animation:eeeLetter .5s cubic-bezier(.2,.9,.3,1.4) forwards}' +
    '#eee-splash .sb{margin-top:8px;font-family:"Segoe UI",Arial,sans-serif;font-size:13px;font-weight:700;color:#fbbf24;text-transform:uppercase;' +
    'opacity:0;animation:eeeSub 1s ease 1.3s forwards}' +
    '#eee-splash .coin{position:absolute;bottom:-40px;font-family:"Segoe UI",Arial,sans-serif;font-weight:900;color:#fbbf24;opacity:0;' +
    'text-shadow:0 0 10px rgba(251,191,36,.7);animation:eeeCoin linear forwards}' +
    '@keyframes eeeRing{to{stroke-dashoffset:0}}' +
    '@keyframes eeeLogo{from{opacity:0;transform:scale(.3) rotate(-25deg)}to{opacity:1;transform:none}}' +
    '@keyframes eeePulse{0%{box-shadow:0 0 0 0 rgba(251,191,36,.7),0 12px 36px rgba(0,0,0,.45)}100%{box-shadow:0 0 0 34px rgba(251,191,36,0),0 12px 36px rgba(0,0,0,.45)}}' +
    '@keyframes eeeShine{to{left:130%}}' +
    '@keyframes eeeLetter{from{opacity:0;transform:translateY(-26px) scale(.6)}to{opacity:1;transform:none}}' +
    '@keyframes eeeSub{from{opacity:0;letter-spacing:0}to{opacity:1;letter-spacing:7px}}' +
    '@keyframes eeeCoin{0%{opacity:0;transform:translateY(0) rotate(0)}15%{opacity:.9}100%{opacity:0;transform:translateY(-110vh) rotate(40deg)}}' +
    '@keyframes eeeCore{0%,85%{transform:scale(1)}100%{transform:scale(1.08)}}' +
    '@media (prefers-reduced-motion:reduce){#eee-splash *{animation-duration:.01s !important;animation-delay:0s !important}}';

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  var box = document.createElement('div');
  box.id = 'eee-splash';

  // rising ৳ coins
  for (var i = 0; i < 9; i++) {
    var c = document.createElement('div');
    c.className = 'coin';
    c.textContent = '৳';
    c.style.left = (6 + Math.random() * 88) + '%';
    c.style.fontSize = (16 + Math.random() * 22) + 'px';
    c.style.animationDuration = (1.8 + Math.random() * 1.4) + 's';
    c.style.animationDelay = (Math.random() * 1.2) + 's';
    box.appendChild(c);
  }

  var core = document.createElement('div');
  core.className = 'core';
  core.innerHTML =
    '<svg viewBox="0 0 160 160"><circle class="ring" cx="80" cy="80" r="70"/></svg>' +
    '<div class="lg"><img src="' + LOGO + '" alt=""></div>';
  box.appendChild(core);

  var nm = document.createElement('div');
  nm.className = 'nm';
  'EEE-13'.split('').forEach(function (ch, k) {
    var s = document.createElement('span');
    s.textContent = ch;
    s.style.animationDelay = (0.9 + k * 0.09) + 's';
    nm.appendChild(s);
  });
  box.appendChild(nm);

  var sb = document.createElement('div');
  sb.className = 'sb';
  sb.textContent = 'Class Fund';
  box.appendChild(sb);

  document.body.appendChild(box);

  setTimeout(function () {
    box.classList.add('out');
    setTimeout(function () { box.remove(); }, CLOSE_MS + 80);
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
