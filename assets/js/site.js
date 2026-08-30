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

export function initMusicPanel(root = document) {
  const musicBtn = root.querySelector('.music-btn');
  const musicPanel = root.querySelector('.music-panel');
  if (!musicBtn || !musicPanel) return;
  const frame = musicPanel.querySelector('iframe');

  const NETEASE_PLAYLIST_ID = '885054268';
  let panelOpen = false;

  musicBtn.addEventListener('click', () => {
    panelOpen = !panelOpen;
    if (panelOpen) {
      // lazy load: empty src would make the iframe load the page itself
      if (frame && !frame.getAttribute('src')) frame.src = frame.dataset.src;
      musicPanel.classList.add('open');
      musicPanel.setAttribute('aria-hidden', 'false');
      musicBtn.classList.add('playing');
    } else {
      musicPanel.classList.remove('open');
      musicPanel.setAttribute('aria-hidden', 'true');
      musicBtn.classList.remove('playing');
    }
  });

  musicBtn.addEventListener('dblclick', () => {
    window.open('https://music.163.com/#/playlist?id=' + NETEASE_PLAYLIST_ID, '_blank');
  });
}

if (typeof document !== 'undefined') {
  initSiteNavigation();
  initMusicPanel();
}
