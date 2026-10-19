/* fixes.js - EEE-13 Class Fund
   Adds: header logo (click = go Home), animated three-line menu button.
   Load this LAST, after dash.js */
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
