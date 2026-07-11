/**
 * Network26 shared header + footer for satellite tool sites (dmarc, spoof, etc.).
 *
 * Usage:
 *   <body data-site-root="https://network26.com/" data-logo="logo-icon.jpg">
 *   <div id="site-nav"></div>
 *   ...
 *   <div id="site-footer"></div>
 *   <script src="nav.js"></script>
 *   <script src="js/chrome.js"></script>
 *
 * Links point at the main Network26 site. Logo defaults to a local file so the
 * tool subdomain does not depend on cross-origin assets.
 */
(function () {
  var DEFAULT_ROOT = 'https://network26.com/';

  function siteRoot() {
    var r = document.body && document.body.dataset.siteRoot;
    if (!r || r === ':') return DEFAULT_ROOT;
    return r.replace(/\/?$/, '/');
  }

  function logoSrc() {
    var logo = document.body && document.body.dataset.logo;
    if (logo && logo !== ':') return logo;
    return 'logo-icon.jpg';
  }

  function join(root, path) {
    if (!path) return root;
    if (/^(https?:|mailto:|tel:)/i.test(path)) return path;
    if (path.startsWith('#')) return root.replace(/\/$/, '') + path;
    return root + path.replace(/^\//, '');
  }

  function phoneIcon() {
    return '<svg xmlns="http://www.w3.org/2000/svg" class="w-[1.05rem] h-[1.05rem] shrink-0 translate-y-[0.5px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>';
  }

  function mailIcon() {
    return '<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>';
  }

  function renderNav(root, logo) {
    var home = join(root, '');
    var services = join(root, 'services/');
    var locations = join(root, 'locations/');
    var about = join(root, 'about.html');
    var contact = join(root, 'contact.html');

    return (
      '\n  <nav class="bg-white border-b border-slate-200 sticky top-0 z-50">' +
      '\n    <div class="max-w-7xl mx-auto px-6">' +
      '\n      <div class="flex items-center justify-between h-16">' +
      '\n        <a href="' + home + '" class="flex items-center gap-x-3 group">' +
      '\n          <img src="' + logo + '" alt="Network26 logo icon" class="h-9 w-9 rounded-xl object-cover">' +
      '\n          <div class="logo-font text-2xl"><span class="text-slate-900">Network</span><span class="text-teal-500 group-hover:text-teal-400 transition-colors">26</span></div>' +
      '\n        </a>' +
      '\n        <div class="hidden md:flex items-center gap-x-8 text-sm font-medium">' +
      '\n          <a href="' + home + '" data-nav-section="home" class="nav-link text-slate-600 hover:text-slate-900">Home</a>' +
      '\n          <a href="' + services + '" data-nav-section="services" class="nav-link text-slate-600 hover:text-slate-900">Services</a>' +
      '\n          <a href="' + locations + '" data-nav-section="locations" class="nav-link text-slate-600 hover:text-slate-900">Locations</a>' +
      '\n          <a href="' + about + '" data-nav-section="about" class="nav-link text-slate-600 hover:text-slate-900">About</a>' +
      '\n          <a href="' + contact + '" data-nav-section="contact" class="nav-link text-slate-600 hover:text-slate-900">Contact</a>' +
      '\n        </div>' +
      '\n        <div class="hidden md:flex items-center gap-x-4">' +
      '\n          <a href="tel:4253689526" class="inline-flex items-center gap-x-2 py-2 text-sm font-semibold text-slate-700 hover:text-teal-600 transition-colors">' +
      '\n            ' + phoneIcon() +
      '\n            <span>425-368-9526</span>' +
      '\n          </a>' +
      '\n          <a href="' + contact + '" class="inline-flex items-center gap-x-1.5 px-5 py-2 text-sm font-semibold rounded-xl teal-btn shadow-sm">' +
      '\n            ' + mailIcon() +
      '\n            <span>Get in Touch</span>' +
      '\n          </a>' +
      '\n        </div>' +
      '\n        <button id="mobile-menu-btn" type="button" class="md:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors" aria-label="Toggle menu" aria-expanded="false">' +
      '\n          <svg id="menu-icon" xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">' +
      '\n            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.25" d="M4 6h16M4 12h16M4 18h16" />' +
      '\n          </svg>' +
      '\n        </button>' +
      '\n      </div>' +
      '\n    </div>' +
      '\n    <div id="mobile-menu" class="hidden md:hidden border-t bg-white px-6 py-5">' +
      '\n      <div class="flex flex-col gap-y-1 text-sm font-medium">' +
      '\n        <a href="' + home + '" data-nav-section="home" class="mobile-link px-3 py-2.5 rounded-xl text-slate-600 hover:bg-slate-50 hover:text-slate-900">Home</a>' +
      '\n        <a href="' + services + '" data-nav-section="services" class="mobile-link px-3 py-2.5 rounded-xl text-slate-600 hover:bg-slate-50 hover:text-slate-900">Services</a>' +
      '\n        <a href="' + locations + '" data-nav-section="locations" class="mobile-link px-3 py-2.5 rounded-xl text-slate-600 hover:bg-slate-50 hover:text-slate-900">Locations</a>' +
      '\n        <a href="' + about + '" data-nav-section="about" class="mobile-link px-3 py-2.5 rounded-xl text-slate-600 hover:bg-slate-50 hover:text-slate-900">About</a>' +
      '\n        <a href="' + contact + '" data-nav-section="contact" class="mobile-link px-3 py-2.5 rounded-xl text-slate-600 hover:bg-slate-50 hover:text-slate-900">Contact</a>' +
      '\n        <div class="pt-3 mt-2 border-t flex flex-col gap-y-3">' +
      '\n          <a href="tel:4253689526" class="flex items-center justify-center gap-x-2 text-base font-semibold py-3 rounded-2xl border border-slate-200 text-slate-700">' +
      '\n            <span class="leading-none">Call 425-368-9526</span>' +
      '\n          </a>' +
      '\n          <a href="' + contact + '" class="teal-btn inline-flex items-center justify-center gap-x-1.5 px-6 py-3 rounded-2xl text-sm font-semibold">' +
      '\n            <span class="leading-none">Get in Touch</span>' +
      '\n          </a>' +
      '\n        </div>' +
      '\n      </div>' +
      '\n    </div>' +
      '\n  </nav>'
    );
  }

  function renderFooter(root, logo) {
    return (
      '\n  <footer class="border-t bg-white">' +
      '\n    <div class="max-w-7xl mx-auto px-6 py-9 text-xs">' +
      '\n      <div class="flex flex-col md:flex-row justify-between gap-y-6 items-center text-slate-500">' +
      '\n        <div class="flex items-center gap-x-3">' +
      '\n          <img src="' + logo + '" alt="Network26" class="h-6 w-6 rounded-lg object-cover opacity-80">' +
      '\n          <div>&copy; 2026 <span class="logo-font"><span class="text-slate-900">Network</span><span class="text-teal-500">26</span></span>. All rights reserved.</div>' +
      '\n        </div>' +
      '\n        <div class="flex flex-wrap justify-center gap-x-5 gap-y-2">' +
      '\n          <a href="' + join(root, 'services/') + '" class="hover:text-slate-700 transition-colors">Services</a>' +
      '\n          <a href="' + join(root, 'locations/') + '" class="hover:text-slate-700 transition-colors">Locations</a>' +
      '\n          <a href="' + join(root, 'tools/') + '" class="hover:text-slate-700 transition-colors">Free Tools</a>' +
      '\n          <a href="' + join(root, 'case-studies/') + '" class="hover:text-slate-700 transition-colors">Case Studies</a>' +
      '\n          <a href="' + join(root, 'privacy.html') + '" class="hover:text-slate-700 transition-colors">Privacy</a>' +
      '\n          <a href="https://support.Network26.com" class="hover:text-slate-700 transition-colors">Support Portal</a>' +
      '\n          <a href="tel:4253689526" class="hover:text-slate-700 transition-colors">425-368-9526</a>' +
      '\n          <a href="mailto:hello@network26.com" class="hover:text-slate-700 transition-colors">hello@network26.com</a>' +
      '\n        </div>' +
      '\n        <div class="text-[10px]">Managed IT · Greater Puget Sound</div>' +
      '\n      </div>' +
      '\n    </div>' +
      '\n  </footer>'
    );
  }

  function initMobileMenu() {
    var btn = document.getElementById('mobile-menu-btn');
    var menu = document.getElementById('mobile-menu');
    var icon = document.getElementById('menu-icon');
    if (!btn || !menu || !icon) return;

    btn.addEventListener('click', function () {
      var isHidden = menu.classList.contains('hidden');
      menu.classList.toggle('hidden');
      btn.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
      icon.innerHTML = isHidden
        ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6h12v12" />'
        : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.25" d="M4 6h16M4 12h16M4 18h16" />';
    });

    document.querySelectorAll('.mobile-link').forEach(function (link) {
      link.addEventListener('click', function () {
        menu.classList.add('hidden');
        btn.setAttribute('aria-expanded', 'false');
        icon.innerHTML =
          '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.25" d="M4 6h16M4 12h16M4 18h16" />';
      });
    });
  }

  function boot() {
    var root = siteRoot();
    var logo = logoSrc();
    var navEl = document.getElementById('site-nav');
    var footerEl = document.getElementById('site-footer');
    if (navEl) navEl.outerHTML = renderNav(root, logo);
    if (footerEl) footerEl.outerHTML = renderFooter(root, logo);
    initMobileMenu();

    var active = document.body.dataset.active;
    if (active && typeof window.initNavHighlight === 'function') {
      window.initNavHighlight({ mode: 'static', activeSection: active });
    }
  }

  boot();
})();
