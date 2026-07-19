export function initSiteNavigation(root = document) {
  const button = root.querySelector('.menu-button');
  const nav = root.querySelector('#site-nav');
  if (!button || !nav) return;

  button.addEventListener('click', () => {
    const open = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!open));
    nav.dataset.open = String(!open);
  });

  nav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      button.setAttribute('aria-expanded', 'false');
      nav.dataset.open = 'false';
    });
  });
}

if (typeof document !== 'undefined') {
  initSiteNavigation();
}
