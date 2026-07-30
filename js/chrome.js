/**
 * Network26 shared header + footer for satellite tool / side-project sites.
 * Nav + footer match the main network26.com chrome (multi-column dark footer).
 *
 * Usage:
 *   <body data-site-root="https://network26.com/" data-logo="logo-icon.jpg" data-active="tools">
 *   <div id="site-nav"></div>
 *   ...
 *   <div id="site-footer"></div>
 *   <script src="nav.js"></script>
 *   <script src="js/chrome.js"></script>
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
    return '<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>';
  }

  function ensureChromeStyles() {
    if (document.getElementById('n26-chrome-styles')) return;
    var style = document.createElement('style');
    style.id = 'n26-chrome-styles';
    style.textContent = [
      '.nav-link.nav-link-active{color:#0d9488;font-weight:700}',
      '.mobile-link.nav-link-active{color:#0d9488;background-color:#f0fdfa;font-weight:700}',
      '.site-footer{background:#0b1220;color:#94a3b8;border-top:1px solid rgba(148,163,184,0.1)}',
      '.site-footer a{color:#cbd5e1;transition:color .12s ease}',
      '.site-footer a:hover{color:#5eead4}',
      '.site-footer .btn{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;border-radius:.875rem;font-weight:600;font-size:.875rem;line-height:1;padding:.75rem 1.15rem;transition:transform .15s ease,background .15s ease;text-decoration:none;border:1px solid transparent;white-space:nowrap}',
      '.site-footer .btn-primary{background:#14b8a6;color:#fff;box-shadow:0 10px 20px -12px rgba(20,184,166,.8)}',
      '.site-footer .btn-primary:hover{background:#0f766e;transform:translateY(-1px);color:#fff}',
      '.logo-font{font-family:Orbitron,\'Space Grotesk\',Inter,system-ui,sans-serif;font-weight:700;letter-spacing:-0.025em}'
    ].join('');
    document.head.appendChild(style);
  }

  function renderNav(root, logo) {
    var home = join(root, '');
    var services = join(root, 'services/');
    var caseStudies = join(root, 'case-studies/');
    var locations = join(root, 'locations/');
    var about = join(root, 'about.html');
    var tools = join(root, 'tools/');
    var contact = join(root, 'contact.html');

    return (
      '\n  <nav class="bg-white border-b border-slate-200 sticky top-0 z-50">' +
      '\n    <div class="max-w-7xl mx-auto px-6">' +
      '\n      <div class="flex items-center justify-between h-16 gap-x-4">' +
      '\n        <a href="' + home + '" class="flex items-center gap-x-3 group shrink-0 relative z-10">' +
      '\n          <img src="' + logo + '" alt="Network26" class="h-9 w-9 rounded-xl object-cover shrink-0 ring-1 ring-slate-200/80">' +
      '\n          <div class="logo-font text-2xl whitespace-nowrap leading-none"><span class="text-slate-900">Network</span><span class="text-teal-500 group-hover:text-teal-400 transition-colors">26</span></div>' +
      '\n        </a>' +
      '\n        <div class="hidden lg:flex items-center gap-x-8 text-[15px]">' +
      '\n          <a href="' + home + '" data-nav-section="home" class="nav-link text-slate-600 hover:text-slate-900">Home</a>' +
      '\n          <a href="' + services + '" data-nav-section="services" class="nav-link text-slate-600 hover:text-slate-900">Services</a>' +
      '\n          <a href="' + caseStudies + '" data-nav-section="case-studies" class="nav-link text-slate-600 hover:text-slate-900">Case Studies</a>' +
      '\n          <a href="' + locations + '" data-nav-section="locations" class="nav-link text-slate-600 hover:text-slate-900">Locations</a>' +
      '\n          <a href="' + about + '" data-nav-section="about" class="nav-link text-slate-600 hover:text-slate-900">About</a>' +
      '\n          <a href="' + tools + '" data-nav-section="tools" class="nav-link text-slate-600 hover:text-slate-900">Tools</a>' +
      '\n        </div>' +
      '\n        <div class="hidden lg:flex items-center gap-x-3 shrink-0">' +
      '\n          <a href="tel:4253689526" class="hidden xl:inline-flex items-center gap-x-2 py-2 px-2 text-sm font-semibold text-slate-700 hover:text-teal-600 transition-colors">' +
      '\n            ' + phoneIcon() +
      '\n            <span>425-368-9526</span>' +
      '\n          </a>' +
      '\n          <a href="' + contact + '" data-nav-section="contact" class="inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold rounded-xl teal-btn shadow-sm">' +
      '\n            Free Assessment' +
      '\n          </a>' +
      '\n        </div>' +
      '\n        <button id="mobile-menu-btn" type="button" class="lg:hidden shrink-0 relative z-10 p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors" aria-label="Toggle menu" aria-expanded="false">' +
      '\n          <svg id="menu-icon" xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">' +
      '\n            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.25" d="M4 6h16M4 12h16M4 18h16" />' +
      '\n          </svg>' +
      '\n        </button>' +
      '\n      </div>' +
      '\n    </div>' +
      '\n    <div id="mobile-menu" class="hidden lg:hidden border-t border-slate-100 bg-white px-6 py-5">' +
      '\n      <div class="flex flex-col gap-y-1 text-sm font-medium">' +
      '\n        <a href="' + home + '" data-nav-section="home" class="mobile-link px-3 py-2.5 rounded-xl text-slate-600 hover:bg-slate-50 hover:text-slate-900">Home</a>' +
      '\n        <a href="' + services + '" data-nav-section="services" class="mobile-link px-3 py-2.5 rounded-xl text-slate-600 hover:bg-slate-50 hover:text-slate-900">Services</a>' +
      '\n        <a href="' + caseStudies + '" data-nav-section="case-studies" class="mobile-link px-3 py-2.5 rounded-xl text-slate-600 hover:bg-slate-50 hover:text-slate-900">Case Studies</a>' +
      '\n        <a href="' + locations + '" data-nav-section="locations" class="mobile-link px-3 py-2.5 rounded-xl text-slate-600 hover:bg-slate-50 hover:text-slate-900">Locations</a>' +
      '\n        <a href="' + about + '" data-nav-section="about" class="mobile-link px-3 py-2.5 rounded-xl text-slate-600 hover:bg-slate-50 hover:text-slate-900">About</a>' +
      '\n        <a href="' + tools + '" data-nav-section="tools" class="mobile-link px-3 py-2.5 rounded-xl text-slate-600 hover:bg-slate-50 hover:text-slate-900">Tools</a>' +
      '\n        <a href="' + contact + '" data-nav-section="contact" class="mobile-link px-3 py-2.5 rounded-xl text-slate-600 hover:bg-slate-50 hover:text-slate-900">Contact</a>' +
      '\n        <div class="pt-3 mt-2 border-t border-slate-100 flex flex-col gap-y-3">' +
      '\n          <a href="tel:4253689526" class="flex items-center justify-center gap-x-2 text-base font-semibold py-3 rounded-2xl border border-slate-200 text-slate-700">' +
      '\n            Call 425-368-9526' +
      '\n          </a>' +
      '\n          <a href="' + contact + '" class="teal-btn inline-flex items-center justify-center px-6 py-3 rounded-2xl text-sm font-semibold">' +
      '\n            Free Assessment' +
      '\n          </a>' +
      '\n        </div>' +
      '\n      </div>' +
      '\n    </div>' +
      '\n  </nav>'
    );
  }

  function renderFooter(root, logo) {
    return (
      '\n  <footer class="site-footer">' +
      '\n    <div class="max-w-7xl mx-auto px-6 pt-14 pb-10">' +
      '\n      <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-12 gap-10 lg:gap-8">' +
      '\n        <div class="col-span-2 md:col-span-4 lg:col-span-4">' +
      '\n          <a href="' + join(root, '') + '" class="inline-flex items-center gap-x-3 group">' +
      '\n            <img src="' + logo + '" alt="Network26" class="h-9 w-9 rounded-xl object-cover ring-1 ring-white/10">' +
      '\n            <div class="logo-font text-xl leading-none"><span class="text-white">Network</span><span class="text-teal-400">26</span></div>' +
      '\n          </a>' +
      '\n          <p class="mt-4 text-sm leading-relaxed text-slate-400 max-w-sm">' +
      '\n            Managed IT, cybersecurity, and help desk for small to medium-sized businesses across the Greater Puget Sound. Proactive support without the enterprise runaround.' +
      '\n          </p>' +
      '\n          <div class="mt-5 flex flex-col gap-2 text-sm">' +
      '\n            <a href="tel:4253689526" class="font-semibold text-white hover:text-teal-300">425-368-9526</a>' +
      '\n            <a href="mailto:hello@network26.com" class="hover:text-teal-300">hello@network26.com</a>' +
      '\n          </div>' +
      '\n        </div>' +
      '\n        <div class="lg:col-span-2">' +
      '\n          <div class="text-xs font-semibold tracking-[0.14em] uppercase text-slate-500 mb-4">Services</div>' +
      '\n          <ul class="space-y-2.5 text-sm">' +
      '\n            <li><a href="' + join(root, 'services/managed-it/') + '">Managed IT</a></li>' +
      '\n            <li><a href="' + join(root, 'services/help-desk/') + '">Help Desk</a></li>' +
      '\n            <li><a href="' + join(root, 'services/cybersecurity/') + '">Cybersecurity</a></li>' +
      '\n            <li><a href="' + join(root, 'services/microsoft-365/') + '">Microsoft 365</a></li>' +
      '\n            <li><a href="' + join(root, 'services/') + '">All services</a></li>' +
      '\n          </ul>' +
      '\n        </div>' +
      '\n        <div class="lg:col-span-2">' +
      '\n          <div class="text-xs font-semibold tracking-[0.14em] uppercase text-slate-500 mb-4">Company</div>' +
      '\n          <ul class="space-y-2.5 text-sm">' +
      '\n            <li><a href="' + join(root, 'about.html') + '">About</a></li>' +
      '\n            <li><a href="' + join(root, 'case-studies/') + '">Case Studies</a></li>' +
      '\n            <li><a href="' + join(root, 'locations/') + '">Locations</a></li>' +
      '\n            <li><a href="' + join(root, 'tools/') + '">Free Tools</a></li>' +
      '\n            <li><a href="' + join(root, 'contact.html') + '">Contact</a></li>' +
      '\n          </ul>' +
      '\n        </div>' +
      '\n        <div class="lg:col-span-2">' +
      '\n          <div class="text-xs font-semibold tracking-[0.14em] uppercase text-slate-500 mb-4">Locations</div>' +
      '\n          <ul class="space-y-2.5 text-sm">' +
      '\n            <li><a href="' + join(root, 'locations/seattle/') + '">Seattle</a></li>' +
      '\n            <li><a href="' + join(root, 'locations/tacoma/') + '">Tacoma</a></li>' +
      '\n            <li><a href="' + join(root, 'locations/olympia/') + '">Olympia</a></li>' +
      '\n            <li><a href="' + join(root, 'locations/puyallup/') + '">Puyallup</a></li>' +
      '\n          </ul>' +
      '\n        </div>' +
      '\n        <div class="col-span-2 md:col-span-4 lg:col-span-2">' +
      '\n          <div class="text-xs font-semibold tracking-[0.14em] uppercase text-slate-500 mb-4">Get started</div>' +
      '\n          <p class="text-sm text-slate-400 mb-4">Free IT assessment. Clear pricing. No pressure.</p>' +
      '\n          <a href="' + join(root, 'contact.html') + '" class="btn btn-primary !text-sm w-full sm:w-auto">Request Assessment</a>' +
      '\n          <div class="mt-4">' +
      '\n            <a href="https://support.Network26.com" class="text-sm text-slate-400 hover:text-teal-300">Support Portal →</a>' +
      '\n          </div>' +
      '\n        </div>' +
      '\n      </div>' +
      '\n      <div class="mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">' +
      '\n        <div>&copy; 2026 <span class="logo-font"><span class="text-slate-300">Network</span><span class="text-teal-500">26</span></span>. All rights reserved.</div>' +
      '\n        <div class="flex flex-wrap justify-center gap-x-5 gap-y-2">' +
      '\n          <a href="' + join(root, 'privacy.html') + '" class="text-slate-400 hover:text-teal-300">Privacy</a>' +
      '\n          <a href="' + join(root, 'contact.html') + '" class="text-slate-400 hover:text-teal-300">Contact</a>' +
      '\n          <span class="text-slate-600">Managed IT · Greater Puget Sound</span>' +
      '\n        </div>' +
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
        ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />'
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
    ensureChromeStyles();
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
