(function () {
  const NAV_OFFSET = 80;

  function getNavLinks() {
    return document.querySelectorAll('[data-nav-section]');
  }

  function setActiveSection(sectionId) {
    getNavLinks().forEach((link) => {
      const isActive = link.dataset.navSection === sectionId;
      link.classList.toggle('nav-link-active', isActive);
      if (isActive) {
        link.setAttribute('aria-current', 'true');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }

  function getSectionTop(el) {
    return el.getBoundingClientRect().top + window.scrollY;
  }

  function initScrollSpy(sectionIds) {
    const orderedSections = sectionIds
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    if (!orderedSections.length) return;

    function update() {
      const scrollPos = window.scrollY + NAV_OFFSET;
      const nearBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 2;

      let current = sectionIds[0];

      if (nearBottom) {
        current = sectionIds[sectionIds.length - 1];
      } else {
        for (const id of sectionIds) {
          const el = document.getElementById(id);
          if (el && getSectionTop(el) <= scrollPos) {
            current = id;
          }
        }
      }

      setActiveSection(current);
    }

    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    window.addEventListener('hashchange', update);
    window.addEventListener('load', update);
    update();
  }

  window.initNavHighlight = function (config) {
    if (config.mode === 'static') {
      setActiveSection(config.activeSection);
      return;
    }

    initScrollSpy(config.sections);
  };
})();