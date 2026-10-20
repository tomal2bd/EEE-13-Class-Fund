/* fixes.js - EEE-13 Class Fund
   Adds: opening splash "Coin Toss" (a gold coin spins up, lands on the logo, light burst, name appears),
   header logo (click = go Home), animated three-line menu button.
   Load this LAST, after dash.js */

/* ---------- Opening splash: Coin Toss ---------- */
(function () {
  var LOGO = 'icon-192.png';
  var MIN_MS = 3200;    // the splash stays at least this long
  var MAX_MS = 4800;    // and never longer than this, even if the page is slow
  var CLOSE_MS = 600;   // fade-out time

  // Show on every fresh open of the app. A normal refresh does not show it again.
  try {
    if (sessionStorage.getItem('eee_splash_done')) return;
    sessionStorage.setItem('eee_splash_done', '1');
  } catch (e) { /* storage not available: show it */ }

  var css =
    '#eee-splash{position:fixed;inset:0;z-index:100000;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;' +
    'background:radial-gradient(circle at 50% 42%,#0b7a57 0%,#044c37 45%,#021f17 100%);' +
    'transition:opacity ' + CLOSE_MS + 'ms ease,transform ' + CLOSE_MS + 'ms ease,filter ' + CLOSE_MS + 'ms ease}' +
    '#eee-splash.out{opacity:0;transform:scale(1.12);filter:blur(6px)}' +

    /* soft light rays turning slowly behind the coin */
    '#eee-splash .rays{position:absolute;left:50%;top:42%;width:150vmax;height:150vmax;margin:-75vmax 0 0 -75vmax;opacity:0;' +
    'background:repeating-conic-gradient(from 0deg,rgba(251,191,36,.16) 0deg 6deg,transparent 6deg 24deg);' +
    '-webkit-mask-image:radial-gradient(circle,#000 0%,transparent 45%);mask-image:radial-gradient(circle,#000 0%,transparent 45%);' +
    'animation:eeeRaysIn 1s ease 1.6s forwards,eeeRaysTurn 12s linear 1.6s infinite}' +

    '#eee-splash .stage{position:relative;width:200px;height:200px;perspective:700px;display:flex;align-items:center;justify-content:center}' +

    /* the toss: up, then down, with a small bounce */
    '#eee-splash .toss{position:relative;width:128px;height:128px;transform-style:preserve-3d;' +
    'animation:eeeToss 1.7s cubic-bezier(.3,.7,.4,1) .1s both}' +
    '#eee-splash .spin{position:absolute;inset:0;transform-style:preserve-3d;animation:eeeSpin 1.7s cubic-bezier(.2,.6,.25,1) .1s both}' +
    '#eee-splash .face{position:absolute;inset:0;border-radius:50%;display:flex;align-items:center;justify-content:center;' +
    '-webkit-backface-visibility:hidden;backface-visibility:hidden;overflow:hidden}' +
    '#eee-splash .front{background:radial-gradient(circle at 35% 30%,#fff3b0 0%,#fbbf24 45%,#b45309 100%);' +
    'border:5px solid #fde68a;box-shadow:inset 0 0 0 5px rgba(180,83,9,.45),0 0 30px rgba(251,191,36,.55);' +
    'font:900 66px "Segoe UI",Arial,sans-serif;color:#78350f;text-shadow:0 2px 0 rgba(255,255,255,.5)}' +
    '#eee-splash .back{transform:rotateY(180deg);background:#fff;border:5px solid #fde68a;box-shadow:0 0 34px rgba(251,191,36,.7)}' +
    '#eee-splash .back img{width:86%;height:86%;object-fit:contain;display:block}' +

    /* shine sweep on the coin face after landing */
    '#eee-splash .back::after{content:"";position:absolute;top:0;left:-80%;width:45%;height:100%;' +
    'background:linear-gradient(100deg,transparent,rgba(255,255,255,.9),transparent);transform:skewX(-20deg);animation:eeeShine .8s ease 1.95s forwards}' +

    /* ground shadow that grows when the coin comes down */
    '#eee-splash .shadow{position:absolute;bottom:6px;left:50%;width:100px;height:14px;margin-left:-50px;border-radius:50%;' +
    'background:rgba(0,0,0,.45);filter:blur(5px);animation:eeeShadow 1.7s ease .1s both}' +

    /* shock rings when it lands */
    '#eee-splash .ring{position:absolute;left:50%;top:50%;width:128px;height:128px;margin:-64px 0 0 -64px;border-radius:50%;' +
    'border:3px solid #fbbf24;opacity:0;animation:eeeRing 1.1s ease-out forwards}' +
    '#eee-splash .ring.r1{animation-delay:1.75s}' +
    '#eee-splash .ring.r2{animation-delay:1.95s;border-color:#fde68a}' +

    /* sparks flying out */
    '#eee-splash .spark{position:absolute;left:50%;top:50%;width:8px;height:8px;margin:-4px 0 0 -4px;border-radius:50%;background:#fde68a;' +
    'box-shadow:0 0 10px 2px rgba(251,191,36,.9);opacity:0;animation:eeeSpark .9s ease-out 1.75s forwards}' +

    /* name + subtitle */
    '#eee-splash .nm{display:flex;margin-top:30px;font-family:"Segoe UI",Arial,sans-serif;font-size:36px;font-weight:900;color:#fff;letter-spacing:3px}' +
    '#eee-splash .nm span{display:inline-block;opacity:0;animation:eeeLetter .55s cubic-bezier(.2,.9,.3,1.4) forwards}' +
    '#eee-splash .sb{margin-top:10px;font-family:"Segoe UI",Arial,sans-serif;font-size:13px;font-weight:700;color:#fbbf24;text-transform:uppercase;' +
    'letter-spacing:8px;opacity:0;animation:eeeSub .9s ease 2.35s forwards}' +

    /* small coins drifting up in the background */
    '#eee-splash .dust{position:absolute;bottom:-30px;font-family:"Segoe UI",Arial,sans-serif;font-weight:900;color:#fbbf24;opacity:0;' +
    'text-shadow:0 0 8px rgba(251,191,36,.6);animation:eeeDust linear forwards}' +

    '@keyframes eeeToss{0%{transform:translateY(70px) scale(.5)}45%{transform:translateY(-78px) scale(1.12)}78%{transform:translateY(0) scale(1)}88%{transform:translateY(-14px) scale(1)}100%{transform:translateY(0) scale(1)}}' +
    '@keyframes eeeSpin{0%{transform:rotateY(0)}100%{transform:rotateY(1980deg)}}' +
    '@keyframes eeeShadow{0%{opacity:.1;transform:scale(.4)}45%{opacity:.2;transform:scale(.55)}78%,100%{opacity:.6;transform:scale(1)}}' +
    '@keyframes eeeRing{0%{opacity:.9;transform:scale(.9)}100%{opacity:0;transform:scale(3.2)}}' +
    '@keyframes eeeSpark{0%{opacity:1;transform:translate(0,0) scale(1)}100%{opacity:0;transform:translate(var(--dx),var(--dy)) scale(.2)}}' +
    '@keyframes eeeShine{to{left:140%}}' +
    '@keyframes eeeRaysIn{to{opacity:1}}' +
    '@keyframes eeeRaysTurn{to{transform:rotate(360deg)}}' +
    '@keyframes eeeLetter{from{opacity:0;transform:translateY(22px) scale(.7)}to{opacity:1;transform:none}}' +
    '@keyframes eeeSub{from{opacity:0}to{opacity:1}}' +
    '@keyframes eeeDust{0%{opacity:0;transform:translateY(0) rotate(0)}20%{opacity:.8}100%{opacity:0;transform:translateY(-105vh) rotate(35deg)}}' +
    '@media (prefers-reduced-motion:reduce){#eee-splash *{animation-duration:.01s !important;animation-delay:0s !important}}';

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  var box = document.createElement('div');
  box.id = 'eee-splash';

  var rays = document.createElement('div');
  rays.className = 'rays';
  box.appendChild(rays);

  // small coins drifting up
  for (var i = 0; i < 8; i++) {
    var d = document.createElement('div');
    d.className = 'dust';
    d.textContent = '৳';
    d.style.left = (6 + Math.random() * 88) + '%';
    d.style.fontSize = (14 + Math.random() * 18) + 'px';
    d.style.animationDuration = (2.2 + Math.random() * 1.6) + 's';
    d.style.animationDelay = (Math.random() * 1.6) + 's';
    box.appendChild(d);
  }

  var stage = document.createElement('div');
  stage.className = 'stage';
  stage.innerHTML =
    '<div class="shadow"></div>' +
    '<div class="ring r1"></div><div class="ring r2"></div>' +
    '<div class="toss"><div class="spin">' +
    '<div class="face front">৳</div>' +
    '<div class="face back"><img src="' + LOGO + '" alt=""></div>' +
    '</div></div>';

  // sparks burst out in all directions
  for (var k = 0; k < 14; k++) {
    var sp = document.createElement('div');
    sp.className = 'spark';
    var ang = (k / 14) * Math.PI * 2 + Math.random() * 0.3;
    var dist = 90 + Math.random() * 60;
    sp.style.setProperty('--dx', Math.round(Math.cos(ang) * dist) + 'px');
    sp.style.setProperty('--dy', Math.round(Math.sin(ang) * dist) + 'px');
    sp.style.animationDelay = (1.75 + Math.random() * 0.12) + 's';
    stage.appendChild(sp);
  }
  box.appendChild(stage);

  var nm = document.createElement('div');
  nm.className = 'nm';
  'EEE-13'.split('').forEach(function (ch, n) {
    var s = document.createElement('span');
    s.textContent = ch;
    s.style.animationDelay = (1.9 + n * 0.09) + 's';
    nm.appendChild(s);
  });
  box.appendChild(nm);

  var sb = document.createElement('div');
  sb.className = 'sb';
  sb.textContent = 'Class Fund';
  box.appendChild(sb);

  document.body.appendChild(box);

  // Close when the minimum time has passed AND the dashboard is ready
  // (or when the maximum time is reached, whichever comes first)
  var startedAt = Date.now();
  var closed = false;
  function close() {
    if (closed) return;
    closed = true;
    box.classList.add('out');
    setTimeout(function () { box.remove(); }, CLOSE_MS + 80);
  }
  function check() {
    var age = Date.now() - startedAt;
    var ready = document.body.classList.contains('dx-ready');
    if (age >= MAX_MS || (age >= MIN_MS && ready)) close();
    else setTimeout(check, 120);
  }
  setTimeout(check, MIN_MS);
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
