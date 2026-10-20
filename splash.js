/* splash.js - EEE-13 Class Fund
   Must be loaded right after <body> (before every other script). */
(function () {
  var fresh = true;
  try {
    if (sessionStorage.getItem('eee_sp4')) fresh = false;
    sessionStorage.setItem('eee_sp4', '1');
    // switches the old coin-toss splash in fixes.js off
    sessionStorage.setItem('eee_splash_done', '1');
  } catch (e) {}

  // fixes.js reads this flag; keep it correct for the new splash
  try {
    Object.defineProperty(window, '__eeeNoSplash', {
      get: function () { return !fresh; },
      set: function () {},
      configurable: true
    });
  } catch (e) {}

  // greeting banner and bKash/Nagad buttons rise in together with the cards
  function pop() {
    ['hello', 'paybar'].forEach(function (id, i) {
      var el = document.getElementById(id);
      if (!el) return;
      el.style.animation = 'eeeRise .8s cubic-bezier(.2,.8,.2,1) ' + (0.04 + i * 0.07) + 's both';
      setTimeout(function () { el.style.animation = ''; }, 2500);
    });
  }
  new MutationObserver(function (m, o) {
    if (document.body.classList.contains('eee-shown')) { o.disconnect(); pop(); }
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  if (!fresh) return;

  var letters = 'EEE-13'.split('').map(function (c, i) {
    return '<span style="animation-delay:' + (1.3 + i * 0.08).toFixed(2) + 's">' + c + '</span>';
  }).join('');
  document.body.insertAdjacentHTML('afterbegin',
    '<div id="eee-splash" aria-hidden="true">' +
    '<div class="sp-stage"><svg class="sp-ring" viewBox="0 0 160 160"><circle class="sp-arc" cx="80" cy="80" r="74"/></svg>' +
    '<img class="sp-logo" src="icon-512.png" alt=""></div>' +
    '<div class="sp-nm">' + letters + '</div><div class="sp-sb">Class Fund</div></div>');

  var box = document.getElementById('eee-splash');
  var t0 = Date.now(), closed = false;
  function close() {
    if (closed) return;
    closed = true;
    try { document.dispatchEvent(new Event('eee-splash-close')); } catch (e) {}
    box.classList.add('out');
    setTimeout(function () { box.remove(); }, 650);
  }
  (function check() {
    var age = Date.now() - t0;
    if (age >= 4500 || (age >= 2600 && document.body.classList.contains('dx-ready'))) close();
    else setTimeout(check, 120);
  })();
})();
