export function initSiteNavigation(root = document) {
  const button = root.querySelector('.menu-button');
  const nav = root.querySelector('#site-nav');
  if (!button || !nav) return;

  // Toggle mobile menu
  button.addEventListener('click', () => {
    const open = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!open));
    nav.dataset.open = String(!open);
  });

  // Close mobile menu on nav link click (only when in mobile mode)
  nav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      // Only collapse if we're actually in mobile mode (menu button is visible)
      const menuIsVisible = window.getComputedStyle(button).display !== 'none';
      if (menuIsVisible) {
        button.setAttribute('aria-expanded', 'false');
        nav.dataset.open = 'false';
      }
    });
  });

  // Close mobile menu on window resize to desktop
  window.addEventListener('resize', () => {
    const menuIsVisible = window.getComputedStyle(button).display !== 'none';
    if (!menuIsVisible) {
      button.setAttribute('aria-expanded', 'false');
      nav.dataset.open = 'false';
    }
  });
}

if (typeof document !== 'undefined') {
  initSiteNavigation();
}
